const GCHousekeepingSubmission = require("../models/GCHousekeepingSubmission");
const { fileToUrl } = require("../middleware/upload");
const { notifyWebhook } = require("../utils/webhook");
const { buildIstDateRangeFilter } = require("../utils/istDateRange");
const { getFormByNumber } = require("../constants/gcHousekeepingForms");

// Starts an in-progress submission with no photos yet — the public form
// calls this once (on first capture or on entering their name) and then
// uploads each checkpoint photo separately via addPhoto, so nothing is ever
// held only in the browser waiting for a final bulk submit.
exports.startSubmission = async (req, res) => {
  const { submittedBy } = req.body;
  const form = getFormByNumber(req.body.formNumber);
  if (!form) return res.status(400).json({ message: "Invalid form number" });
  if (!submittedBy) return res.status(400).json({ message: "submittedBy is required" });

  const submission = await GCHousekeepingSubmission.create({
    formNumber: form.formNumber,
    submittedBy,
    status: "in_progress",
    photos: [],
  });
  res.status(201).json(submission);
};

// Uploads one checkpoint's photo and saves it to the submission immediately
// — retaking a checkpoint just re-calls this and replaces the existing
// entry for that checkpointId.
exports.addPhoto = async (req, res) => {
  const submission = await GCHousekeepingSubmission.findById(req.params.id);
  if (!submission) return res.status(404).json({ message: "Submission not found" });
  if (submission.status === "submitted") return res.status(400).json({ message: "This submission was already submitted" });
  if (!req.file) return res.status(400).json({ message: "photo is required" });

  const checkpointId = Number(req.body.checkpointId);
  if (!checkpointId) return res.status(400).json({ message: "checkpointId is required" });

  let geoLocation = {};
  try {
    geoLocation = req.body.geoLocation ? JSON.parse(req.body.geoLocation) : {};
  } catch {
    geoLocation = {};
  }

  const photo = {
    checkpointId,
    photoUrl: fileToUrl(req.file),
    capturedAt: req.body.capturedAt ? new Date(req.body.capturedAt) : new Date(),
    geoLocation,
  };

  const existingIdx = submission.photos.findIndex((p) => p.checkpointId === checkpointId);
  if (existingIdx >= 0) submission.photos[existingIdx] = photo;
  else submission.photos.push(photo);

  await submission.save();
  res.json(submission);
};

exports.finalizeSubmission = async (req, res) => {
  const submission = await GCHousekeepingSubmission.findById(req.params.id);
  if (!submission) return res.status(404).json({ message: "Submission not found" });
  if (submission.status === "submitted") return res.status(400).json({ message: "Already submitted" });

  const form = getFormByNumber(submission.formNumber);
  const expectedCount = form.checkpointEnd - form.checkpointStart + 1;
  if (submission.photos.length < expectedCount) {
    return res.status(400).json({ message: "All checkpoints must have a photo before submitting" });
  }

  submission.status = "submitted";
  await submission.save();

  // Plain text with each image URL on its own line — Slack auto-unfurls a
  // direct image link into a full inline preview, even for bot-posted messages.
  const messageLines = [
    `🧹 *${submission.submittedBy}* submitted *${form.label}* (Garden City Housekeeping) — checkpoints ${form.checkpointStart}-${form.checkpointEnd}`,
    "",
    ...submission.photos.map((p) => `Checkpoint ${p.checkpointId}: ${p.photoUrl}`),
  ];

  notifyWebhook({
    type: "gc_housekeeping",
    formNumber: form.formNumber,
    formLabel: form.label,
    submittedBy: submission.submittedBy,
    checkpointsCovered: submission.photos.length,
    submittedAt: submission.submittedAt,
    message: messageLines.join("\n"),
  });

  res.json(submission);
};

exports.listSubmissions = async (req, res) => {
  const { formNumber, dateFrom, dateTo } = req.query;
  // $ne (not $eq) so submissions created before the status field existed —
  // which have no status at all, not "in_progress" — still show up here.
  const filter = { status: { $ne: "in_progress" } };
  if (formNumber) filter.formNumber = Number(formNumber);
  const dateFilter = buildIstDateRangeFilter(dateFrom, dateTo);
  if (dateFilter) filter.submittedAt = dateFilter;

  const submissions = await GCHousekeepingSubmission.find(filter).sort({ submittedAt: -1 });
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
  const submission = await GCHousekeepingSubmission.findById(req.params.id);
  if (!submission) return res.status(404).json({ message: "Submission not found" });
  res.json(submission);
};
