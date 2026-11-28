const MaintenanceAuditSubmission = require("../models/MaintenanceAuditSubmission");
const { fileToUrl } = require("../middleware/upload");
const { notifyWebhook } = require("../utils/webhook");

const PROJECTS = ["Garden City", "Regal Garden", "Milestone", "Neo Meridian", "OBC", "Nature Park", "Regal Central"];

exports.meta = async (req, res) => {
  res.json({ projects: PROJECTS });
};

exports.createSubmission = async (req, res) => {
  const { clientName, unitNo, project, remarks } = req.body;
  if (!clientName || !unitNo || !project || !remarks) {
    return res.status(400).json({ message: "clientName, unitNo, project and remarks are required" });
  }
  if (!PROJECTS.includes(project)) {
    return res.status(400).json({ message: "Invalid project" });
  }

  const image1 = req.files?.image1?.[0];
  const image2 = req.files?.image2?.[0];

  const submission = await MaintenanceAuditSubmission.create({
    clientName,
    unitNo,
    project,
    remarks,
    image1Url: image1 ? fileToUrl(image1) : "",
    image2Url: image2 ? fileToUrl(image2) : "",
  });

  notifyWebhook(
    {
      type: "maintenanceAudit",
      clientName,
      unitNo,
      project,
      remarks,
      image1Url: submission.image1Url,
      image2Url: submission.image2Url,
      submittedAt: submission.submittedAt,
      message: `🛠️ Maintenance Audit — *${clientName}* (Unit ${unitNo}, ${project})\nRemarks: ${remarks}`,
    },
    "N8N_MAINTENANCE_AUDIT_WEBHOOK_URL"
  );

  res.status(201).json(submission);
};

exports.listSubmissions = async (req, res) => {
  const { project } = req.query;
  const filter = {};
  if (project) filter.project = project;

  const submissions = await MaintenanceAuditSubmission.find(filter).sort({ submittedAt: -1 });
  res.json(submissions);
};
