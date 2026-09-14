const mongoose = require("mongoose");
const { COMPANY_NAMES } = require("../constants/companies");

const MaintenanceStaffSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, unique: true, trim: true },
    siteName: { type: String, required: true, trim: true },
    designation: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    // Not required — existing staff predate this field and get it filled in
    // gradually by HR rather than all at once. Not enum-constrained here
    // (the dropdown enforces valid values client-side) so it can't reject
    // a save just because this field wasn't touched.
    companyName: { type: String, default: "" },
    photo: { type: String, default: "" },
  },
  { timestamps: true }
);

MaintenanceStaffSchema.statics.COMPANY_NAMES = COMPANY_NAMES;

MaintenanceStaffSchema.index({ siteName: 1, designation: 1 });

module.exports = mongoose.model("MaintenanceStaff", MaintenanceStaffSchema);
