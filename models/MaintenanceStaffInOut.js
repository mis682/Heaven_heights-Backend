const mongoose = require("mongoose");

// A simple gate-style in/out log for maintenance staff visiting the main
// office — unlike daily Attendance (QR scan, geofenced, derives a day
// status), this is just an ad-hoc timestamped record of one staff member
// going in or out, picked from a dropdown by whoever's at the desk.
const MaintenanceStaffInOutSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, trim: true },
    employeeName: { type: String, required: true, trim: true },
    status: { type: String, enum: ["In", "Out"], required: true },
    reason: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MaintenanceStaffInOut", MaintenanceStaffInOutSchema);
