const mongoose = require("mongoose");
const { RESERVE_REGAL_CLUB_STATUS_OPTIONS } = require("../constants/gcClubReportStatus");
const { MCB_STATUS_OPTIONS } = require("../constants/mcbReportStatus");

// "Yes"/"No" (a "select"-type checkpoint, e.g. Handwash) and the MCB forms'
// ON/OFF vocabulary are appended here rather than filtered per-form/
// checkpoint, since this is just a storage-level allow-list, not what's
// actually offered in the UI for any given row/form.
const HeadOfficeEntrySchema = new mongoose.Schema(
  {
    checkpointLabel: { type: String, required: true },
    status: {
      type: String,
      enum: [...new Set([...RESERVE_REGAL_CLUB_STATUS_OPTIONS, "Yes", "No", ...MCB_STATUS_OPTIONS, ""])],
      default: "",
    },
  },
  { _id: false }
);

// Reuses the same status vocabulary as Reserve Club / Regal Garden Club /
// One Business Center / Nature Park / Regal Garden — see
// RESERVE_REGAL_CLUB_STATUS_OPTIONS. One report per (form, date) pair, same
// reasoning as this module's forms each having their own distinct checklist.
const HeadOfficeDailyReportSchema = new mongoose.Schema(
  {
    formNumber: { type: Number, required: true },
    reportDate: { type: String, required: true },
    entries: [HeadOfficeEntrySchema],
    status: { type: String, enum: ["draft", "submitted"], default: "draft" },
    preparedBy: { type: String, default: "" },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

HeadOfficeDailyReportSchema.index({ formNumber: 1, reportDate: 1 }, { unique: true });

module.exports = mongoose.model("HeadOfficeDailyReport", HeadOfficeDailyReportSchema);
