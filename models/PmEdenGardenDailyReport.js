const mongoose = require("mongoose");
const { RESERVE_REGAL_CLUB_STATUS_OPTIONS } = require("../constants/gcClubReportStatus");

const PmEdenGardenEntrySchema = new mongoose.Schema(
  {
    checkpointLabel: { type: String, required: true },
    status: { type: String, enum: [...RESERVE_REGAL_CLUB_STATUS_OPTIONS, ""], default: "" },
  },
  { _id: false }
);

// Reuses the same status vocabulary as Reserve Club / Regal Garden Club /
// One Business Center / Nature Park / (Housekeeping) Regal Garden — see
// RESERVE_REGAL_CLUB_STATUS_OPTIONS. One report per (form, date) pair, same
// reasoning as this module's forms each having their own distinct checklist.
const PmEdenGardenDailyReportSchema = new mongoose.Schema(
  {
    formNumber: { type: Number, required: true },
    reportDate: { type: String, required: true },
    entries: [PmEdenGardenEntrySchema],
    status: { type: String, enum: ["draft", "submitted"], default: "draft" },
    preparedBy: { type: String, default: "" },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

PmEdenGardenDailyReportSchema.index({ formNumber: 1, reportDate: 1 }, { unique: true });

module.exports = mongoose.model("PmEdenGardenDailyReport", PmEdenGardenDailyReportSchema);
