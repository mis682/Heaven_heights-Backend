const mongoose = require("mongoose");

// A simple manual monthly count — HR types in how many extra/overtime days
// a staff member worked that month. Not tied to any specific date (unlike
// AttendanceOverride), since overtime here is reported as a month total,
// not per-day.
const AttendanceOvertimeSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true },
    month: { type: Number, required: true }, // 1-12
    year: { type: Number, required: true },
    days: { type: Number, required: true, min: 0 },
    setBy: { type: String, default: "" },
  },
  { timestamps: true }
);

AttendanceOvertimeSchema.index({ employeeId: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model("AttendanceOvertime", AttendanceOvertimeSchema);
