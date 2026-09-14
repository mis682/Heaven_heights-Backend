const ReserveClubSubmission = require("../models/ReserveClubSubmission");
const { fileToUrl } = require("../middleware/upload");
const { notifyWebhook } = require("../utils/webhook");
const { buildIstDateRangeFilter } = require("../utils/istDateRange");
const { getFormByNumber } = require("../constants/reserveClubForms");

exports.createSubmission = async (req, res) => {
  const { submittedBy } = req.body;
  const form = getFormByNumber(req.body.formNumber);
  if (!form) return res.status(400).json({ message: "Invalid form number" });
  if (!submittedBy) return res.status(400).json({ message: "submittedBy is required" });

  let meta = [];
  try {
    meta = req.body.meta ? JSON.parse(req.body.meta) : [];
  } catch {
    return res.status(400).json({ message: "Invalid meta payload" });
  }

  let textAnswers = [];
  try {
    textAnswers = req.body.textAnswers ? JSON.parse(req.body.textAnswers) : [];
  } catch {
    return res.status(400).json({ message: "Invalid textAnswers payload" });
  }

  const files = req.files || [];
  const photos = files.map((file, idx) => {
    const info = meta[idx] || {};
    return {
      checkpointLabel: info.checkpointLabel,
      photoUrl: fileToUrl(file),
      capturedAt: info.capturedAt ? new Date(info.capturedAt) : new Date(),
      geoLocation: info.geoLocation || {},
    };
  });

  const submission = await ReserveClubSubmission.create({
    formNumber: form.formNumber,
    submittedBy,
    photos,
    textAnswers,
  });

  const messageLines = [
    `🏆 *${submittedBy}* submitted *${form.label}* (Neoteric Reserve Club) — ${photos.length} checkpoints`,
    "",
    ...photos.map((p) => `${p.checkpointLabel}: ${p.photoUrl}`),
    ...textAnswers.map((t) => `${t.label}: ${t.value}`),
  ];

  notifyWebhook({
    type: "reserve_club",
    formNumber: form.formNumber,
    formLabel: form.label,
    submittedBy,
    checkpointsCovered: photos.length,
    submittedAt: submission.submittedAt,
    message: messageLines.join("\n"),
  });

  res.status(201).json(submission);
};

exports.listSubmissions = async (req, res) => {
  const { formNumber, dateFrom, dateTo } = req.query;
  const filter = {};
  if (formNumber) filter.formNumber = Number(formNumber);
  const dateFilter = buildIstDateRangeFilter(dateFrom, dateTo);
  if (dateFilter) filter.submittedAt = dateFilter;

  const submissions = await ReserveClubSubmission.find(filter).sort({ submittedAt: -1 });
  res.json(
    submissions.map((s) => ({
      _id: s._id,
      formNumber: s.formNumber,
      submittedBy: s.submittedBy,
      submittedAt: s.submittedAt,
      photoCount: s.photos.length,
    }))
  );
};

exports.getSubmission = async (req, res) => {
  const submission = await ReserveClubSubmission.findById(req.params.id);
  if (!submission) return res.status(404).json({ message: "Submission not found" });
  res.json(submission);
};
