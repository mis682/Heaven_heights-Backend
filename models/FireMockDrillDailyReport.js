const mongoose = require("mongoose");
const { FIRE_MOCK_DRILL_STATUS_OPTIONS } = require("../constants/fireMockDrillReportStatus");

// Each "checkpoint" here is one of the submission's actual attachments
// (Panel Photo, Video 1..N, Checklist Page 1..3) rather than a fixed form
// checkpoint — built fresh from the matching FireMockDrill submission the
// first time a coordinator opens this date+project (see
// fireMockDrillReportController.js's submissionFor).
const FireMockDrillReportEntrySchema = new mongoose.Schema(
  {
    attachmentLabel: { type: String, required: true },
    attachmentUrl: { type: String, default: "" },
    status: { type: String, enum: [...FIRE_MOCK_DRILL_STATUS_OPTIONS, ""], default: "" },
  },
  { _id: false }
);

// One report per (projectName, reportDate) — mirrors the (formNumber,
// reportDate) uniqueness every other module's Daily Report uses, just keyed
// by project since Fire Mock Drill has no multi-form concept. Snapshots
// (maintenanceSupervisor, issueIdentified, issueDescription, actionTaken)
// are copied from the submission at report-creation time rather than joined
// live, so this report stays accurate even if the original submission is
// later edited or removed.
const FireMockDrillDailyReportSchema = new mongoose.Schema(
  {
    projectName: { type: String, required: true },
    reportDate: { type: String, required: true },
    submissionId: { type: mongoose.Schema.Types.ObjectId, ref: "FireMockDrill", default: null },
    maintenanceSupervisor: { type: String, default: "" },
    issueIdentified: { type: String, default: "" },
    issueDescription: { type: String, default: "" },
    actionTaken: { type: String, default: "" },
    entries: [FireMockDrillReportEntrySchema],
    status: { type: String, enum: ["draft", "submitted"], default: "draft" },
    preparedBy: { type: String, default: "" },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

FireMockDrillDailyReportSchema.index({ projectName: 1, reportDate: 1 }, { unique: true });

module.exports = mongoose.model("FireMockDrillDailyReport", FireMockDrillDailyReportSchema);
