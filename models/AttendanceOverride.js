const mongoose = require("mongoose");

// A manual HR correction for one staff member's one day, taking precedence
// over whatever the raw scan data would otherwise compute — the underlying
// AttendanceScan records are left untouched, this just overrides the
// displayed/exported status for that specific day.
const AttendanceOverrideSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true },
    date: { type: String, required: true }, // "YYYY-MM-DD"
    status: { type: String, enum: ["P", "A", "HD", "SP"], required: true },
    setBy: { type: String, default: "" },
  },
  { timestamps: true }
);

AttendanceOverrideSchema.index({ employeeId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("AttendanceOverride", AttendanceOverrideSchema);
