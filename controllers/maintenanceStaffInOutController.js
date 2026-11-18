const MaintenanceStaffInOut = require("../models/MaintenanceStaffInOut");

exports.create = async (req, res) => {
  const { date, contractorName, staffName, mobileNumber, work, inTime } = req.body;
  if (!date || !contractorName || !staffName || !mobileNumber || !work || !inTime) {
    return res.status(400).json({ message: "date, contractorName, staffName, mobileNumber, work and inTime are required" });
  }

  const entry = await MaintenanceStaffInOut.create({ date, contractorName, staffName, mobileNumber, work, inTime });
  res.status(201).json(entry);
};

exports.list = async (req, res) => {
  const entries = await MaintenanceStaffInOut.find({}).sort({ createdAt: -1 }).limit(1000);
  res.json(entries);
};

// Coordinator fills this in later, once the labour/staff actually leaves —
// the only field editable after creation via the quick inline picker.
exports.setOutTime = async (req, res) => {
  const { id } = req.params;
  const { outTime } = req.body;
  if (outTime === undefined) return res.status(400).json({ message: "outTime is required" });

  const entry = await MaintenanceStaffInOut.findByIdAndUpdate(id, { outTime }, { new: true });
  if (!entry) return res.status(404).json({ message: "Entry not found" });
  res.json(entry);
};

const EDITABLE_FIELDS = ["date", "contractorName", "staffName", "mobileNumber", "work", "inTime", "outTime"];

exports.update = async (req, res) => {
  const { id } = req.params;
  const update = {};
  EDITABLE_FIELDS.forEach((f) => {
    if (req.body[f] !== undefined) update[f] = req.body[f];
  });

  const entry = await MaintenanceStaffInOut.findByIdAndUpdate(id, update, { new: true, runValidators: true });
  if (!entry) return res.status(404).json({ message: "Entry not found" });
  res.json(entry);
};

exports.remove = async (req, res) => {
  const entry = await MaintenanceStaffInOut.findByIdAndDelete(req.params.id);
  if (!entry) return res.status(404).json({ message: "Entry not found" });
  res.json({ message: "Deleted" });
};
