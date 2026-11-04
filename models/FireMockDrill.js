const mongoose = require("mongoose");

const FireMockDrillSchema = new mongoose.Schema(
  {
    projectName: { type: String, required: true, trim: true },
    maintenanceSupervisor: { type: String, default: "" },
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
    // Auto-generated at submission time (see utils/fireMockDrillIssuePdf.js)
    // — a one-page summary of project/supervisor/date plus the 3 issue
    // questions and whatever was actually answered, uploaded to Drive.
    issueReportPdf: { type: String, default: "" },
    // Set by the coordinator from the Submissions table (not the submitter)
    // — tracks the identified issue through to resolution so a manager can
    // tell at a glance whether it's still open.
    issueStatus: { type: String, enum: ["Open", "Closed", "WIP", "Pending", "Complete", ""], default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FireMockDrill", FireMockDrillSchema);
