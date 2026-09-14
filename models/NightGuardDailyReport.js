const mongoose = require("mongoose");
const { STATUS_OPTIONS } = require("../constants/reportStatus");

// One row per hour of the night shift. Time is auto-assigned in sequence
// when a shift set is added (not a coordinator-selected dropdown) — see
// makeShiftSet() on the client.
const TIME_SLOTS = [
  "9:00 PM",
  "10:00 PM",
  "11:00 PM",
  "12:00 AM",
  "1:00 AM",
  "2:00 AM",
  "3:00 AM",
  "4:00 AM",
  "5:00 AM",
  "6:00 AM",
];

const NightGuardReportEntrySchema = new mongoose.Schema(
  {
    // Each entry picks its own date (a report is an open-ended log of rounds,
    // not scoped to a single day) — this was previously a report-level field.
    date: { type: String, required: true },
    site: { type: String, required: true },
    // Not enum-constrained so older submitted reports (any legacy time
    // label) stay valid on re-save, e.g. after an admin unlock.
    timeSlot: { type: String, required: true },
    guardName: { type: String, required: true },
    status: { type: String, enum: STATUS_OPTIONS, required: true },
    linkedSubmissionId: { type: mongoose.Schema.Types.ObjectId, ref: "NightGuardSubmission", default: null },
  },
  { _id: true }
);

const NightGuardDailyReportSchema = new mongoose.Schema(
  {
    // Deprecated — older submitted reports (before per-entry dates) still
    // carry this; new reports leave it unset and use entries[].date instead.
    reportDate: { type: String },
    entries: [NightGuardReportEntrySchema],
    status: { type: String, enum: ["draft", "submitted"], default: "draft" },
    preparedBy: { type: String, default: "" },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

NightGuardDailyReportSchema.statics.STATUS_OPTIONS = STATUS_OPTIONS;
NightGuardDailyReportSchema.statics.TIME_SLOTS = TIME_SLOTS;

module.exports = mongoose.model("NightGuardDailyReport", NightGuardDailyReportSchema);
