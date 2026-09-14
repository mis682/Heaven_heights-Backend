const mongoose = require("mongoose");
const { GC_HOUSEKEEPING_STATUS_OPTIONS } = require("../constants/gcHousekeepingReportStatus");

const GCHousekeepingEntrySchema = new mongoose.Schema(
  {
    checkpointId: { type: Number, required: true },
    status: { type: String, enum: [...GC_HOUSEKEEPING_STATUS_OPTIONS, ""], default: "" },
  },
  { _id: false }
);

// One document per calendar date (like GardenCityPatrolReport under
// Security) — a coordinator picks a date, all 150 checkpoint rows appear at
// once (pre-populated in the controller), and they just set each row's
// status. Separate model from the Security one on purpose — different
// module, different status vocabulary, different row shape (no
// guard/time — just checkpoint + status).
const GCHousekeepingDailyReportSchema = new mongoose.Schema(
  {
    reportDate: { type: String, required: true, unique: true },
    entries: [GCHousekeepingEntrySchema],
    status: { type: String, enum: ["draft", "submitted"], default: "draft" },
    preparedBy: { type: String, default: "" },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GCHousekeepingDailyReport", GCHousekeepingDailyReportSchema);
