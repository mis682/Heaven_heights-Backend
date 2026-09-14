const mongoose = require("mongoose");
const { GC_CLUB_STATUS_OPTIONS } = require("../constants/gcClubReportStatus");

const GCClubEntrySchema = new mongoose.Schema(
  {
    checkpointLabel: { type: String, required: true },
    status: { type: String, enum: [...GC_CLUB_STATUS_OPTIONS, ""], default: "" },
  },
  { _id: false }
);

// One report per (form, date) pair — unlike Garden City Housekeeping's
// single unified 150-checkpoint checklist, each Club form's checklist is
// its own distinct list (First Floor's items have nothing to do with
// Swimming Pool's), so the coordinator picks both a form and a date before
// seeing that form's checklist for that day.
const GCClubDailyReportSchema = new mongoose.Schema(
  {
    formNumber: { type: Number, required: true },
    reportDate: { type: String, required: true },
    entries: [GCClubEntrySchema],
    status: { type: String, enum: ["draft", "submitted"], default: "draft" },
    preparedBy: { type: String, default: "" },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

GCClubDailyReportSchema.index({ formNumber: 1, reportDate: 1 }, { unique: true });

module.exports = mongoose.model("GCClubDailyReport", GCClubDailyReportSchema);
