const mongoose = require("mongoose");
const { RESERVE_REGAL_CLUB_STATUS_OPTIONS } = require("../constants/gcClubReportStatus");

const PmRegalGardenEntrySchema = new mongoose.Schema(
  {
    checkpointLabel: { type: String, required: true },
    status: { type: String, enum: [...RESERVE_REGAL_CLUB_STATUS_OPTIONS, ""], default: "" },
    value: { type: String, default: "" },
  },
  { _id: false }
);

// Reuses the same status vocabulary as Reserve Club / Regal Garden Club /
// One Business Center / Nature Park / (Housekeeping) Regal Garden — see
// RESERVE_REGAL_CLUB_STATUS_OPTIONS. One report per (form, date, unit) —
// the same form/date can have many reports, one per unit being photographed
// (e.g. Unit 18 and Unit 19 both get their own Oct 14 report), so "Unit No."
// is a report-identifying field here rather than just another checkpoint.
const PmRegalGardenDailyReportSchema = new mongoose.Schema(
  {
    formNumber: { type: Number, required: true },
    reportDate: { type: String, required: true },
    unitNo: { type: String, required: true },
    entries: [PmRegalGardenEntrySchema],
    status: { type: String, enum: ["draft", "submitted"], default: "draft" },
    preparedBy: { type: String, default: "" },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

PmRegalGardenDailyReportSchema.index({ formNumber: 1, reportDate: 1, unitNo: 1 }, { unique: true });

module.exports = mongoose.model("PmRegalGardenDailyReport", PmRegalGardenDailyReportSchema);
