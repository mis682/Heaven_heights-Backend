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

// One report per calendar date (not per site/form — every staff member
// across every site appears as a row in the same single report), grouped by
// designation when rendered.
const MaintenanceUniformDailyReportSchema = new mongoose.Schema(
  {
    reportDate: { type: String, required: true, unique: true },
    entries: [MaintenanceUniformEntrySchema],
    status: { type: String, enum: ["draft", "submitted"], default: "draft" },
    preparedBy: { type: String, default: "" },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MaintenanceUniformDailyReport", MaintenanceUniformDailyReportSchema);
