const mongoose = require("mongoose");

const FireMockDrillSchema = new mongoose.Schema(
  {
    projectName: { type: String, required: true, trim: true },
    date: { type: String, required: true },
    panelPhoto: { type: String, default: "" },
    videos: [{ type: String }],
    reportAttachment: { type: String, default: "" },
    checklistAttachments: [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("FireMockDrill", FireMockDrillSchema);
