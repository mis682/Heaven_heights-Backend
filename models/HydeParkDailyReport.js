const mongoose = require("mongoose");
const { RESERVE_REGAL_CLUB_STATUS_OPTIONS } = require("../constants/gcClubReportStatus");

// "Yes"/"No" are only ever set for a "select"-type checkpoint (Water Coming
// in Motor) — appended here rather than filtered per-checkpoint, since this
// is just a storage-level allow-list, not what's actually offered in the UI
// for any given row.
const HydeParkEntrySchema = new mongoose.Schema(
  {
    checkpointLabel: { type: String, required: true },
    status: { type: String, enum: [...RESERVE_REGAL_CLUB_STATUS_OPTIONS, "Yes", "No", ""], default: "" },
  },
  { _id: false }
);

// Reuses the same status vocabulary as Reserve Club / Regal Garden Club /
// One Business Center / Nature Park / Neo Meridian / Milestone / Head
// Office — see RESERVE_REGAL_CLUB_STATUS_OPTIONS. One report per (form,
// date) pair, same reasoning as this module's forms each having their own
// distinct checklist.
const HydeParkDailyReportSchema = new mongoose.Schema(
  {
    formNumber: { type: Number, required: true },
    reportDate: { type: String, required: true },
    entries: [HydeParkEntrySchema],
    status: { type: String, enum: ["draft", "submitted"], default: "draft" },
    preparedBy: { type: String, default: "" },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

HydeParkDailyReportSchema.index({ formNumber: 1, reportDate: 1 }, { unique: true });

module.exports = mongoose.model("HydeParkDailyReport", HydeParkDailyReportSchema);
