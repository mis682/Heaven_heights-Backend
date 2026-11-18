const MaintenanceStaff = require("../models/MaintenanceStaff");
const MaintenanceStaffInOut = require("../models/MaintenanceStaffInOut");
const { transliterateToHindi } = require("../utils/hindiTransliterate");

// Staff list for the form's dropdown — Hindi name alongside the English
// one in the same label (not Hindi alone) so typing on a normal English
// keyboard still finds someone via ThemedSelect's built-in search, which
// just substring-matches the label text.
exports.meta = async (req, res) => {
  const staffList = await MaintenanceStaff.find({}).sort({ name: 1 });
  const staff = staffList.map((s) => ({
    employeeId: s.employeeId,
    name: s.name,
    nameHindi: transliterateToHindi(s.name),
  }));
  res.json({ staff });
};

exports.create = async (req, res) => {
  const { date, contractorName, employeeId, mobileNumber, work, inTime } = req.body;
  if (!date || !contractorName || !employeeId || !mobileNumber || !work || !inTime) {
    return res.status(400).json({ message: "date, contractorName, employeeId, mobileNumber, work and inTime are required" });
  }

  const staff = await MaintenanceStaff.findOne({ employeeId });
  if (!staff) return res.status(404).json({ message: "Staff not found" });

  const entry = await MaintenanceStaffInOut.create({
    date,
    contractorName,
    employeeId,
    employeeName: staff.name,
    mobileNumber,
    work,
    inTime,
  });
  res.status(201).json(entry);
};

exports.list = async (req, res) => {
  const entries = await MaintenanceStaffInOut.find({}).sort({ createdAt: -1 }).limit(1000);
  res.json(entries);
};

// Coordinator fills this in later, once the labour/staff actually leaves —
// the only field editable after creation.
exports.setOutTime = async (req, res) => {
  const { id } = req.params;
  const { outTime } = req.body;
  if (outTime === undefined) return res.status(400).json({ message: "outTime is required" });

  const entry = await MaintenanceStaffInOut.findByIdAndUpdate(id, { outTime }, { new: true });
  if (!entry) return res.status(404).json({ message: "Entry not found" });
  res.json(entry);
};
