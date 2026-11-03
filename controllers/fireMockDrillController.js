const FireMockDrill = require("../models/FireMockDrill");
const { notifyWebhook } = require("../utils/webhook");
const { sendAlertEmail } = require("../utils/mailer");
const { sendTelegramMessage } = require("../utils/telegram");
const { uploadToDrive } = require("../utils/googleDrive");
const { compressVideo } = require("../utils/videoCompress");

const PROJECTS = ["Regal Garden", "Neo Meridian", "Milestone", "OBC", "Eden Garden"];

exports.meta = async (req, res) => {
  res.json({ projects: PROJECTS });
};

// All Fire Mock Drill files (panel photo, videos, report, checklist pages)
// go to this app's own Google Drive folder instead of Cloudinary — unlike
// every other module's photos, which upload straight from the browser to
// Cloudinary (see api/media/upload-signature), these relay through this
// server because a video needs compressing before it's stored. A dedicated
// GOOGLE_DRIVE_FIRE_MOCK_DRILL_FOLDER_ID keeps these separate from the
// shared archive folder (falls back to the default archive folder if unset).
exports.uploadFile = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  const folderId = process.env.GOOGLE_DRIVE_FIRE_MOCK_DRILL_FOLDER_ID || undefined;
  const isVideo = req.file.mimetype.startsWith("video/");

  let buffer = req.file.buffer;
  let mimeType = req.file.mimetype;
  let filename = req.file.originalname;

  if (isVideo) {
    try {
      buffer = await compressVideo(req.file.buffer);
      mimeType = "video/mp4";
      filename = filename.replace(/\.[^.]+$/, "") + ".mp4";
    } catch (err) {
      return res.status(500).json({ message: "Video compression failed — please try a different video" });
    }
  }

  const { url } = await uploadToDrive({ buffer, filename, mimeType, folderId });
  res.json({ url });
};

function parseVideoUrls(raw) {
  if (raw === undefined) return null;
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, 8) : [];
  } catch {
    return [];
  }
}

// Panel photo, report and checklist attachments upload straight from the
// browser to Cloudinary (see api/media/upload-signature), same as videos
// already did — this just receives the resulting URLs as JSON.
exports.create = async (req, res) => {
  const { projectName, date, videoUrls, panelPhoto: panelPhotoUrl, reportAttachment: reportAttachmentUrl } = req.body;
  if (!projectName || !date) {
    return res.status(400).json({ message: "Project and date are required" });
  }

  const panelPhoto = panelPhotoUrl || "";
  const videos = parseVideoUrls(videoUrls) || [];
  const reportAttachment = reportAttachmentUrl || "";
  const checklistAttachments = Array.isArray(req.body.checklistAttachments) ? req.body.checklistAttachments : [];

  const drill = await FireMockDrill.create({ projectName, date, panelPhoto, videos, reportAttachment, checklistAttachments });

  const messageLines = [`🔥 *Fire Mock Drill* submitted for *${projectName}*`, `📅 Date: ${date}`];
  if (panelPhoto) messageLines.push("", "Panel Photo:", panelPhoto);
  checklistAttachments.forEach((url, idx) => messageLines.push(`Checklist Page ${idx + 1}: ${url}`));
  if (reportAttachment) messageLines.push(`📄 Report: ${reportAttachment}`);
  videos.forEach((url, idx) => messageLines.push(`🎥 Video ${idx + 1}: ${url}`));

  notifyWebhook(
    {
      type: "fire_mock_drill",
      projectName,
      date,
      panelPhoto,
      videoCount: videos.length,
      reportAttachment,
      checklistCount: checklistAttachments.length,
      message: messageLines.join("\n"),
    },
    "N8N_FIRE_MOCK_DRILL_WEBHOOK_URL"
  );

  const htmlParts = [
    `<p><b>Fire Mock Drill</b> submitted for <b>${projectName}</b></p>`,
    `<p>Date: ${date}</p>`,
  ];
  if (panelPhoto) htmlParts.push(`<p>Panel Photo:<br/><img src="${panelPhoto}" alt="Panel photo" style="max-width:480px" /></p>`);
  checklistAttachments.forEach((url, idx) => {
    htmlParts.push(`<p>Checklist Page ${idx + 1}:<br/><a href="${url}">${url}</a></p>`);
  });
  if (reportAttachment) htmlParts.push(`<p>Report: <a href="${reportAttachment}">${reportAttachment}</a></p>`);
  videos.forEach((url, idx) => {
    htmlParts.push(`<p>Video ${idx + 1}: <a href="${url}">${url}</a></p>`);
  });

  sendAlertEmail({
    subject: `Fire Mock Drill submitted — ${projectName} (${date})`,
    text: messageLines.join("\n"),
    html: htmlParts.join("\n"),
  });

  // Plain text, no *bold* markers — Telegram's Markdown parser fails the
  // whole send on any unescaped special character, which the raw URLs
  // below routinely contain.
  const telegramLines = [`Fire Mock Drill submitted for ${projectName}`, `Date: ${date}`];
  checklistAttachments.forEach((url, idx) => telegramLines.push(`Checklist Page ${idx + 1}: ${url}`));
  if (reportAttachment) telegramLines.push(`Report: ${reportAttachment}`);
  videos.forEach((url, idx) => telegramLines.push(`Video ${idx + 1}: ${url}`));

  sendTelegramMessage({
    text: telegramLines.join("\n"),
    photoUrl: panelPhoto,
  });

  res.status(201).json(drill);
};

exports.list = async (req, res) => {
  const { projectName, search } = req.query;
  const filter = {};
  if (projectName) filter.projectName = projectName;
  if (search) {
    const re = new RegExp(search, "i");
    filter.$or = [{ projectName: re }, { date: re }];
  }
  const drills = await FireMockDrill.find(filter).sort({ date: -1, createdAt: -1 });
  res.json(drills);
};

exports.getOne = async (req, res) => {
  const drill = await FireMockDrill.findById(req.params.id);
  if (!drill) return res.status(404).json({ message: "Not found" });
  res.json(drill);
};

exports.update = async (req, res) => {
  const existing = await FireMockDrill.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: "Not found" });

  const body = {};
  if (req.body.projectName) body.projectName = req.body.projectName;
  if (req.body.date) body.date = req.body.date;
  if (req.body.panelPhoto) body.panelPhoto = req.body.panelPhoto;
  if (req.body.reportAttachment) body.reportAttachment = req.body.reportAttachment;
  if (Array.isArray(req.body.checklistAttachments)) body.checklistAttachments = req.body.checklistAttachments;

  // The client sends the full desired list of video URLs each time (kept
  // existing ones + newly direct-uploaded ones), since videos never pass
  // through this server as files.
  const videos = parseVideoUrls(req.body.videoUrls);
  if (videos !== null) body.videos = videos;

  const drill = await FireMockDrill.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
  res.json(drill);
};

exports.remove = async (req, res) => {
  const drill = await FireMockDrill.findByIdAndDelete(req.params.id);
  if (!drill) return res.status(404).json({ message: "Not found" });
  res.json({ message: "Deleted" });
};
