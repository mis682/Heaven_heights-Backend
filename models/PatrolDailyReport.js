const mongoose = require("mongoose");
const { STATUS_OPTIONS } = require("../constants/reportStatus");

const TIME_SLOTS = [
  "12:00 AM TO 1:00 AM",
  "1:00 AM TO 2:00 AM",
  "2:00 AM TO 3:00 AM",
  "3:00 AM TO 4:00 AM",
  "4:00 AM TO 5:00 AM",
  "5:00 AM TO 6:00 AM",
  "6:00 AM TO 7:00 AM",
  "7:00 AM TO 8:00 AM",
  "8:00 AM TO 9:00 AM",
  "9:00 AM TO 10:00 AM",
  "10:00 AM TO 11:00 AM",
  "11:00 AM TO 12:00 PM",
  "12:00 PM TO 1:00 PM",
  "1:00 PM TO 2:00 PM",
  "2:00 PM TO 3:00 PM",
  "3:00 PM TO 4:00 PM",
  "4:00 PM TO 5:00 PM",
  "5:00 PM TO 6:00 PM",
  "6:00 PM TO 7:00 PM",
  "7:00 PM TO 8:00 PM",
  "8:00 PM TO 9:00 PM",
  "9:00 PM TO 10:00 PM",
  "10:00 PM TO 11:00 PM",
  "11:00 PM TO 12:00 AM",
];

const PatrolReportEntrySchema = new mongoose.Schema(
  {
    // Each entry picks its own date (a report is an open-ended log of rounds,
    // not scoped to a single day) — this was previously a report-level field.
    date: { type: String, required: true },
    guardName: { type: String, required: true },
    // Not enum-restricted to TIME_SLOTS: some sites (e.g. Nature Park) use a
    // custom set of irregular time ranges instead of the default hourly grid.
    timeSlot: { type: String, required: true },
    checkpointStatuses: [{ type: String, enum: [...STATUS_OPTIONS, ""], default: "" }],
  },
  { _id: true }
);

const PatrolDailyReportSchema = new mongoose.Schema(
  {
    // Deprecated — older submitted reports (before per-entry dates) still
    // carry this; new reports leave it unset and use entries[].date instead.
    reportDate: { type: String },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    projectName: { type: String, required: true },
    checkpointCount: { type: Number, required: true },
    entries: [PatrolReportEntrySchema],
    status: { type: String, enum: ["draft", "submitted"], default: "draft" },
    preparedBy: { type: String, default: "" },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

PatrolDailyReportSchema.statics.STATUS_OPTIONS = STATUS_OPTIONS;
PatrolDailyReportSchema.statics.TIME_SLOTS = TIME_SLOTS;

module.exports = mongoose.model("PatrolDailyReport", PatrolDailyReportSchema);
