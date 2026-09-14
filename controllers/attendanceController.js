const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");

exports.stats = async (req, res) => {
  const { date } = req.query;
  const day = date || new Date().toISOString().slice(0, 10);

  const [totalStaff, records] = await Promise.all([
    Employee.countDocuments({ active: true }),
    Attendance.find({ date: day }),
  ]);

  const present = records.filter((r) => r.status === "Present").length;
  const absent = records.filter((r) => r.status === "Absent").length;
  const onLeave = records.filter((r) => r.status === "Leave").length;
  const lateCheckIn = records.filter((r) => r.isLate).length;
  const pendingApproval = records.filter((r) => r.approvalStatus === "Pending").length;

  res.json({ totalStaff, present, absent, onLeave, lateCheckIn, pendingApproval });
};

exports.list = async (req, res) => {
  const { date, department, status, staff } = req.query;
  const filter = {};
  if (date) filter.date = date;
  if (status) filter.status = status;
  if (staff) filter.staff = staff;

  let query = Attendance.find(filter).populate("staff", "name employeeId department").sort({ date: -1 });
  let records = await query;

  if (department) {
    records = records.filter((r) => r.staff && r.staff.department === department);
  }

  res.json(records);
};

exports.create = async (req, res) => {
  const employee = await Employee.findById(req.body.staff);
  const body = { ...req.body };

  if (employee && body.checkInTime && employee.shiftStart) {
    body.isLate = body.checkInTime > employee.shiftStart;
  }
  if (body.status === "Leave") {
    body.approvalStatus = "Pending";
  }

  const record = await Attendance.findOneAndUpdate(
    { date: body.date, staff: body.staff },
    body,
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );

  res.status(201).json(record);
};

exports.update = async (req, res) => {
  const record = await Attendance.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!record) return res.status(404).json({ message: "Attendance record not found" });
  res.json(record);
};

exports.remove = async (req, res) => {
  const record = await Attendance.findByIdAndDelete(req.params.id);
  if (!record) return res.status(404).json({ message: "Attendance record not found" });
  res.json({ message: "Attendance record deleted" });
};
