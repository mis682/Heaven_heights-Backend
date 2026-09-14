const Project = require("../models/Project");
const Checkpoint = require("../models/Checkpoint");

exports.list = async (req, res) => {
  const { module: mod } = req.query;
  const filter = {};
  if (mod) filter.module = mod;
  const projects = await Project.find(filter).sort({ name: 1 });
  res.json(projects);
};

exports.getBySlug = async (req, res) => {
  const project = await Project.findOne({ slug: req.params.slug });
  if (!project) return res.status(404).json({ message: "Project not found" });
  const checkpoints = await Checkpoint.find({ projectId: project._id }).sort({ order: 1 });
  res.json({ project, checkpoints });
};

exports.updateCheckpointCount = async (req, res) => {
  const { checkpointCount } = req.body;
  if (!Number.isInteger(checkpointCount) || checkpointCount < 1) {
    return res.status(400).json({ message: "checkpointCount must be a positive integer" });
  }

  const project = await Project.findOneAndUpdate({ slug: req.params.slug }, { checkpointCount }, { new: true });
  if (!project) return res.status(404).json({ message: "Project not found" });

  await Checkpoint.deleteMany({ projectId: project._id });
  const checkpoints = Array.from({ length: checkpointCount }, (_, i) => ({
    projectId: project._id,
    checkpointId: i + 1,
    name: `Checkpoint ${i + 1}`,
    order: i + 1,
  }));
  await Checkpoint.insertMany(checkpoints);

  res.json({ project, checkpoints });
};
