const mongoose = require("mongoose");

const FireMockDrillSchema = new mongoose.Schema(
  {
    projectName: { type: String, required: true, trim: true },
    date: { type: String, required: true },
    panelPhoto: { type: String, default: "" },
    videos: [{ type: String }],
    checklistAttachments: [{ type: String }],
    issueIdentified: { type: String, enum: ["Yes", "No", ""], default: "" },
    issueDescription: { type: String, default: "" },
    actionTaken: { type: String, default: "" },
    issueEvidence: { type: String, default: "" },
    // Drive proxy URLs have no file extension to tell a photo from a video
    // by, unlike Cloudinary URLs — this is set at submission time from the
    // actual file picked, so the admin view knows which tag to render.
    issueEvidenceType: { type: String, enum: ["photo", "video", ""], default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FireMockDrill", FireMockDrillSchema);
