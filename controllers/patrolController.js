const mongoose = require("mongoose");
const PatrolSubmission = require("../models/PatrolSubmission");
const Project = require("../models/Project");
const Checkpoint = require("../models/Checkpoint");
const { fileToUrl } = require("../middleware/upload");
const { notifyWebhook } = require("../utils/webhook");
const { buildIstDateRangeFilter } = require("../utils/istDateRange");

exports.createSubmission = async (req, res) => {
  const { guardName, projectId, projectName } = req.body;
  if (!guardName || !projectId || !projectName) {
    return res.status(400).json({ message: "guardName, projectId and projectName are required" });
  }

  let meta = [];
  try {
    meta = req.body.meta ? JSON.parse(req.body.meta) : [];
  } catch {
    return res.status(400).json({ message: "Invalid meta payload" });
  }

  const files = req.files || [];
  const photos = files.map((file, idx) => {
    const info = meta[idx] || {};
    return {
      checkpointId: info.checkpointId,
      photoUrl: fileToUrl(file),
      capturedAt: info.capturedAt ? new Date(info.capturedAt) : new Date(),
      geoLocation: info.geoLocation || {},
    };
  });

  const submission = await PatrolSubmission.create({
    guardName,
    projectId,
    projectName,
    photos,
  });

  const checkpointDocs = await Checkpoint.find({ projectId, checkpointId: { $in: photos.map((p) => p.checkpointId) } });
  const checkpointNameById = new Map(checkpointDocs.map((c) => [c.checkpointId, c.name]));
  const checkpoints = photos.map((p) => ({
    name: checkpointNameById.get(p.checkpointId) || `Checkpoint ${p.checkpointId}`,
    photoUrl: p.photoUrl,
    capturedAt: p.capturedAt,
  }));

  // Plain text with each image URL on its own line — Slack auto-unfurls a
  // direct image link into a full inline preview, even for bot-posted messages.
  const messageLines = [
    `🛡️ *${guardName}* submitted a Patrol Checkpoint form for *${projectName}*`,
    "",
    ...checkpoints.map((c) => `${c.name}: ${c.photoUrl}`),
  ];

  notifyWebhook({
    type: "patrol_checkpoint",
    guardName,
    projectName,
    checkpointsCovered: photos.length,
    checkpoints,
    submittedAt: submission.submittedAt,
    message: messageLines.join("\n"),
  });

  res.status(201).json(submission);
};

// A list/summary view — only ever needs each submission's checkpoint COUNT,
// never the actual photos (those are fetched separately via getSubmission
// when someone opens one). find().find() used to pull every full document,
// photos array included, out of Atlas just to read .length off it, plus a
// separate Project lookup per submission. The aggregation below computes
// the count and joins the project's checkpointCount server-side, so this
// list only ever transfers a handful of small fields per row.
exports.listSubmissions = async (req, res) => {
  const { projectId, dateFrom, dateTo } = req.query;
  const match = {};
  if (projectId) match.projectId = new mongoose.Types.ObjectId(projectId);
  const dateFilter = buildIstDateRangeFilter(dateFrom, dateTo);
  if (dateFilter) match.submittedAt = dateFilter;

  const submissions = await PatrolSubmission.aggregate([
    { $match: match },
    { $sort: { submittedAt: -1 } },
    {
      $lookup: {
        from: "projects",
        localField: "projectId",
        foreignField: "_id",
        as: "project",
      },
    },
    {
      $project: {
        guardName: 1,
        projectName: 1,
        submittedAt: 1,
        checkpointsCovered: { $size: "$photos" },
        checkpointCount: { $ifNull: [{ $arrayElemAt: ["$project.checkpointCount", 0] }, 0] },
      },
    },
  ]);

  res.json(submissions);
};

// Powers the Patrol Reports overview page — just a per-site submission
// count and average checkpoint-coverage %. Computed with an aggregation
// instead of listSubmissions' approach (pull every raw submission, with its
// full photos array, out of Atlas and reduce client-side) so a page
// coordinators reload many times a day only ever transfers a few small
// summary rows, not the whole collection.
exports.getSummary = async (req, res) => {
  const { dateFrom, dateTo } = req.query;
  const dateFilter = buildIstDateRangeFilter(dateFrom, dateTo);

  const [projects, agg] = await Promise.all([
    Project.find({ module: "patrol_checkpoint" }).select("name checkpointCount"),
    PatrolSubmission.aggregate([
      { $match: { submittedAt: dateFilter } },
      {
        $group: {
          _id: "$projectName",
          submissionCount: { $sum: 1 },
          totalCheckpointsCovered: { $sum: { $size: "$photos" } },
        },
      },
    ]),
  ]);

  const statsByProject = new Map(agg.map((a) => [a._id, a]));

  const rows = projects.map((project) => {
    const stats = statsByProject.get(project.name);
    const submissionCount = stats?.submissionCount || 0;
    const avgCoveragePct =
      submissionCount > 0 && project.checkpointCount > 0
        ? Math.round((stats.totalCheckpointsCovered / submissionCount / project.checkpointCount) * 100)
        : 0;
    return {
      _id: project._id,
      name: project.name,
      checkpointCount: project.checkpointCount,
      submissionCount,
      avgCoveragePct,
    };
  });

  res.json(rows);
};

exports.getSubmission = async (req, res) => {
  const submission = await PatrolSubmission.findById(req.params.id);
  if (!submission) return res.status(404).json({ message: "Submission not found" });
  res.json(submission);
};
