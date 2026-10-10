const MaintenanceUniformSubmission = require("../models/MaintenanceUniformSubmission");
const { notifyWebhook } = require("../utils/webhook");
const { buildIstDateRangeFilter } = require("../utils/istDateRange");

// Photo uploads straight from the browser to Cloudinary (see
// api/media/upload-signature) before this ever runs — this just receives
// the resulting URL as plain JSON, not the file itself.
exports.createSubmission = async (req, res) => {
  const { siteName, designation, staffName, shift, photoUrl } = req.body;
  if (!siteName || !designation || !staffName || !shift || !photoUrl) {
    return res.status(400).json({ message: "siteName, designation, staffName, shift and photoUrl are all required" });
  }

  const submission = await MaintenanceUniformSubmission.create({ siteName, designation, staffName, shift, photoUrl });

  notifyWebhook(
    {
      type: "maintenance_uniform",
      siteName,
      designation,
      staffName,
      shift,
      submittedAt: submission.submittedAt,
      message: `🦺 *${staffName}* (${designation}, ${siteName}, ${shift} shift) submitted a uniform photo\n${photoUrl}`,
    },
    "N8N_MAINTENANCE_UNIFORM_WEBHOOK_URL"
  );

  res.status(201).json(submission);
};

exports.listSubmissions = async (req, res) => {
  const { siteName, designation, dateFrom, dateTo } = req.query;
  const filter = {};
  if (siteName) filter.siteName = siteName;
  if (designation) filter.designation = designation;
  const dateFilter = buildIstDateRangeFilter(dateFrom, dateTo);
  if (dateFilter) filter.submittedAt = dateFilter;

  const submissions = await MaintenanceUniformSubmission.find(filter).sort({ submittedAt: -1 });
  res.json(submissions);
};

exports.getSubmission = async (req, res) => {
  const submission = await MaintenanceUniformSubmission.findById(req.params.id);
  if (!submission) return res.status(404).json({ message: "Submission not found" });
  res.json(submission);
};
