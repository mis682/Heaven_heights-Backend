const MaintenanceStaff = require("../models/MaintenanceStaff");
const AttendanceOvertime = require("../models/AttendanceOvertime");

// Staff list for a given month/year, each joined with their overtime days
// for that month (0 if HR hasn't entered one yet) — same staff-filter
// shape as Team Attendance's monthSummary, so search works the same way.
exports.list = async (req, res) => {
  const { month, year, search } = req.query;
  if (!month || !year) return res.status(400).json({ message: "month and year are required" });

  const staffFilter = {};
  if (search) {
    const re = new RegExp(search, "i");
    staffFilter.$or = [{ name: re }, { employeeId: re }, { siteName: re }];
  }
  const staffList = await MaintenanceStaff.find(staffFilter).sort({ employeeId: 1 });

  const entries = await AttendanceOvertime.find({ month: Number(month), year: Number(year) });
  const byEmployee = new Map(entries.map((e) => [e.employeeId, e]));

  const rows = staffList.map((staff) => {
    const entry = byEmployee.get(staff.employeeId);
    return {
      employeeId: staff.employeeId,
      name: staff.name,
      siteName: staff.siteName,
      designation: staff.designation,
      companyName: staff.companyName || "",
      photo: staff.photo,
      days: entry?.days ?? 0,
      setBy: entry?.setBy || "",
    };
  });

  res.json({ rows, month: Number(month), year: Number(year) });
};

exports.setOvertime = async (req, res) => {
  const { employeeId, month, year, days, setBy } = req.body;
  if (!employeeId || !month || !year || days === undefined) {
    return res.status(400).json({ message: "employeeId, month, year and days are required" });
  }
  const entry = await AttendanceOvertime.findOneAndUpdate(
    { employeeId, month: Number(month), year: Number(year) },
    { days: Number(days), setBy: setBy || "" },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.json(entry);
};
