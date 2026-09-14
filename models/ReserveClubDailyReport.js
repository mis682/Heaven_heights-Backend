const mongoose = require("mongoose");
const { GC_CLUB_STATUS_OPTIONS } = require("../constants/gcClubReportStatus");

const ReserveClubEntrySchema = new mongoose.Schema(
  {
    checkpointLabel: { type: String, required: true },
    status: { type: String, enum: [...GC_CLUB_STATUS_OPTIONS, ""], default: "" },
  },
  { _id: false }
);

// Reuses Garden City Club's status vocabulary (GC_CLUB_STATUS_OPTIONS) —
// same convention, no reason given yet to diverge. One report per
// (form, date) pair, same reasoning as ReserveClub's forms each having
// their own distinct checklist.
const ReserveClubDailyReportSchema = new mongoose.Schema(
  {
    formNumber: { type: Number, required: true },
    reportDate: { type: String, required: true },
    entries: [ReserveClubEntrySchema],
    status: { type: String, enum: ["draft", "submitted"], default: "draft" },
    preparedBy: { type: String, default: "" },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ReserveClubDailyReportSchema.index({ formNumber: 1, reportDate: 1 }, { unique: true });

module.exports = mongoose.model("ReserveClubDailyReport", ReserveClubDailyReportSchema);
