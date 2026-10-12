const mongoose = require("mongoose");
const { MAINTENANCE_UNIFORM_STATUS_OPTIONS, MAINTENANCE_UNIFORM_REPORT_FORMATS } = require("../constants/maintenanceUniformStatus");

// Entries are snapshotted (staffId + name/designation/site at the time the
// report was built) rather than just a staffId reference — a staff member
// renamed, reassigned, or removed later must not silently change what an
// already-submitted historical report shows.
const MaintenanceUniformEntrySchema = new mongoose.Schema(
  {
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: "MaintenanceStaff" },
    staffName: { type: String, required: true },
    designation: { type: String, required: true },
    siteName: { type: String, required: true },
    status: { type: String, enum: [...MAINTENANCE_UNIFORM_STATUS_OPTIONS, ""], default: "" },
  },
  { _id: false }
);

// One report per (calendar date, report name) — the checklist is split
// across two coordinators, each with their own fixed set of sites (see
// MAINTENANCE_UNIFORM_REPORT_FORMATS), so the same date has one report per
// coordinator rather than a single combined one.
const MaintenanceUniformDailyReportSchema = new mongoose.Schema(
  {
    reportDate: { type: String, required: true },
    reportName: { type: String, required: true, enum: Object.keys(MAINTENANCE_UNIFORM_REPORT_FORMATS) },
    entries: [MaintenanceUniformEntrySchema],
    status: { type: String, enum: ["draft", "submitted"], default: "draft" },
    preparedBy: { type: String, default: "" },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

MaintenanceUniformDailyReportSchema.index({ reportDate: 1, reportName: 1 }, { unique: true });

module.exports = mongoose.model("MaintenanceUniformDailyReport", MaintenanceUniformDailyReportSchema);
