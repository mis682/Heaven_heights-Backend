const { v2: cloudinary } = require("cloudinary");
const FireMockDrill = require("../models/FireMockDrill");
const { fileToUrl } = require("../middleware/upload");
const { notifyWebhook } = require("../utils/webhook");
const { sendAlertEmail } = require("../utils/mailer");
const { sendTelegramMessage } = require("../utils/telegram");

const PROJECTS = ["Regal Garden", "Neo Meridian", "Milestone", "OBC", "Eden Garden"];
const VIDEO_FOLDER = "heaven-heights/fire-mock-drill-videos";

exports.meta = async (req, res) => {
  res.json({ projects: PROJECTS });
};

// Videos upload straight from the browser to Cloudinary (bypassing our
// server) since they can be large — this endpoint just hands out a short-lived
// signed upload authorization instead of relaying the file itself.
exports.getUploadSignature = async (req, res) => {
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = { timestamp, folder: VIDEO_FOLDER };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);
  res.json({
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    folder: VIDEO_FOLDER,
  });
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

exports.create = async (req, res) => {
  const { projectName, date, videoUrls } = req.body;
  if (!projectName || !date) {
    return res.status(400).json({ message: "Project and date are required" });
  }

  const panelPhoto = req.files?.panelPhoto?.[0] ? fileToUrl(req.files.panelPhoto[0]) : "";
  const videos = parseVideoUrls(videoUrls) || [];
  const reportAttachment = req.files?.reportAttachment?.[0] ? fileToUrl(req.files.reportAttachment[0]) : "";
  const checklistAttachments = (req.files?.checklistAttachments || []).map(fileToUrl);

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
  if (req.files?.panelPhoto?.[0]) body.panelPhoto = fileToUrl(req.files.panelPhoto[0]);
  if (req.files?.reportAttachment?.[0]) body.reportAttachment = fileToUrl(req.files.reportAttachment[0]);
  if (req.files?.checklistAttachments?.length) body.checklistAttachments = req.files.checklistAttachments.map(fileToUrl);

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
