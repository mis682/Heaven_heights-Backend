const mongoose = require("mongoose");
const { MAINTENANCE_UNIFORM_STATUS_OPTIONS } = require("../constants/maintenanceUniformStatus");

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

// One combined report per calendar date, covering every site at once —
// `reportName` used to split this across two coordinators (each with their
// own fixed set of sites, see MAINTENANCE_UNIFORM_REPORT_FORMATS); that
// split was reverted, so new reports always leave it as "" (one coordinator
// handles every site's responses in a single report now). The field and its
// index are kept rather than dropped so the old Priyanka/Niketa-era reports
// stay valid, readable history instead of needing a data migration.
const MaintenanceUniformDailyReportSchema = new mongoose.Schema(
  {
    reportDate: { type: String, required: true },
    reportName: { type: String, default: "" },
    entries: [MaintenanceUniformEntrySchema],
    status: { type: String, enum: ["draft", "submitted"], default: "draft" },
    preparedBy: { type: String, default: "" },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

MaintenanceUniformDailyReportSchema.index({ reportDate: 1, reportName: 1 }, { unique: true });

module.exports = mongoose.model("MaintenanceUniformDailyReport", MaintenanceUniformDailyReportSchema);
