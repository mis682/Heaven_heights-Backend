const mongoose = require("mongoose");
const { RESERVE_REGAL_CLUB_STATUS_OPTIONS } = require("../constants/gcClubReportStatus");

const RegalGardenClubEntrySchema = new mongoose.Schema(
  {
    checkpointLabel: { type: String, required: true },
    status: { type: String, enum: [...RESERVE_REGAL_CLUB_STATUS_OPTIONS, ""], default: "" },
  },
  { _id: false }
);

// Reuses Garden City Club's status vocabulary plus the two extra statuses
// (NA, Guest) this module needs — see RESERVE_REGAL_CLUB_STATUS_OPTIONS.
// One report per (form, date) pair, same reasoning as Reserve Club's forms
// each having their own distinct checklist.
const RegalGardenClubDailyReportSchema = new mongoose.Schema(
  {
    formNumber: { type: Number, required: true },
    reportDate: { type: String, required: true },
    entries: [RegalGardenClubEntrySchema],
    status: { type: String, enum: ["draft", "submitted"], default: "draft" },
    preparedBy: { type: String, default: "" },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

RegalGardenClubDailyReportSchema.index({ formNumber: 1, reportDate: 1 }, { unique: true });

module.exports = mongoose.model("RegalGardenClubDailyReport", RegalGardenClubDailyReportSchema);
