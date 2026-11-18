const mongoose = require("mongoose");

// A gate-style register: one row per labour/staff visit, filled in at
// check-in time (Date, Contractor/Supervisor, Labour/Staff, Mobile, Work,
// In-Time) — Out-Time starts empty and is filled in later by the
// coordinator once that person leaves, from the Submissions page.
// Labour/Staff Name is free text (typed by whoever fills the form), not
// picked from the Maintenance Staff master list — covers external
// contractor labour, not just this app's own staff.
const MaintenanceStaffInOutSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    contractorName: { type: String, required: true, trim: true },
    staffName: { type: String, required: true, trim: true },
    mobileNumber: { type: String, required: true, trim: true },
    work: { type: String, required: true, trim: true },
    inTime: { type: String, required: true },
    outTime: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MaintenanceStaffInOut", MaintenanceStaffInOutSchema);
