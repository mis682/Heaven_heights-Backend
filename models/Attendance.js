const mongoose = require("mongoose");

const AttendanceSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    staff: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    checkInTime: { type: String, default: "" },
    checkOutTime: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Present", "Absent", "Half-day", "Leave"],
      default: "Present",
    },
    isLate: { type: Boolean, default: false },
    markedBy: { type: String, default: "" },
    leaveReason: { type: String, default: "" },
    approvalStatus: { type: String, enum: ["N/A", "Pending", "Approved", "Rejected"], default: "N/A" },
  },
  { timestamps: true }
);

AttendanceSchema.index({ date: 1, staff: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", AttendanceSchema);
