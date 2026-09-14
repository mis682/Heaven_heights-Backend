const mongoose = require("mongoose");
const { STATUS_OPTIONS } = require("../constants/reportStatus");

const GardenCityEntrySchema = new mongoose.Schema(
  {
    checkpointLabel: { type: String, required: true },
    time: { type: String, required: true },
    guardName: { type: String, default: "" },
    status: { type: String, enum: [...STATUS_OPTIONS, ""], default: "" },
  },
  { _id: false }
);

const GardenCityPatrolReportSchema = new mongoose.Schema(
  {
    reportDate: { type: String, required: true, unique: true },
    entries: [GardenCityEntrySchema],
    status: { type: String, enum: ["draft", "submitted"], default: "draft" },
    preparedBy: { type: String, default: "" },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GardenCityPatrolReport", GardenCityPatrolReportSchema);
