const mongoose = require("mongoose");
const { PM_STATUS_OPTIONS } = require("../constants/pmReportStatus");

const PmEdenGardenEntrySchema = new mongoose.Schema(
  {
    checkpointLabel: { type: String, required: true },
    status: { type: String, enum: [...PM_STATUS_OPTIONS, ""], default: "" },
    value: { type: String, default: "" },
  },
  { _id: false }
);

// Uses PM's own status vocabulary (see PM_STATUS_OPTIONS) — the same base
// as Reserve Club/Regal Garden Club/(Housekeeping) Regal Garden plus "Under
// Construction", which only makes sense for a unit-by-unit report. One
// report per (form, date, unit) —
// the same form/date can have many reports, one per unit being photographed
// (e.g. Unit 18 and Unit 19 both get their own Oct 14 report), so "Unit No."
// is a report-identifying field here rather than just another checkpoint.
const PmEdenGardenDailyReportSchema = new mongoose.Schema(
  {
    formNumber: { type: Number, required: true },
    reportDate: { type: String, required: true },
    unitNo: { type: String, required: true },
    entries: [PmEdenGardenEntrySchema],
    status: { type: String, enum: ["draft", "submitted"], default: "draft" },
    preparedBy: { type: String, default: "" },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

PmEdenGardenDailyReportSchema.index({ formNumber: 1, reportDate: 1, unitNo: 1 }, { unique: true });

module.exports = mongoose.model("PmEdenGardenDailyReport", PmEdenGardenDailyReportSchema);
