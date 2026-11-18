const mongoose = require("mongoose");

// A gate-style register: one row per labour/staff visit, filled in at
// check-in time (Date, Contractor/Supervisor, Labour/Staff, Mobile, Work,
// In-Time) — Out-Time starts empty and is filled in later by the
// coordinator once that person leaves, from the Submissions page.
const MaintenanceStaffInOutSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    contractorName: { type: String, required: true, trim: true },
    employeeId: { type: String, required: true, trim: true },
    employeeName: { type: String, required: true, trim: true },
    mobileNumber: { type: String, required: true, trim: true },
    work: { type: String, required: true, trim: true },
    inTime: { type: String, required: true },
    outTime: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MaintenanceStaffInOut", MaintenanceStaffInOutSchema);
