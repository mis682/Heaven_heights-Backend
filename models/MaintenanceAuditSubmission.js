const mongoose = require("mongoose");

// Flat single-form submission — no checklist/checkpoints, just a handful
// of fields plus up to two optional photos. No "submitted by" field since
// the form itself doesn't ask for one.
const MaintenanceAuditSubmissionSchema = new mongoose.Schema(
  {
    clientName: { type: String, required: true, trim: true },
    unitNo: { type: String, required: true, trim: true },
    project: {
      type: String,
      required: true,
      enum: ["Garden City", "Regal Garden", "Milestone", "Neo Meridian", "OBC", "Nature Park", "Regal Central"],
    },
    remarks: { type: String, required: true, trim: true },
    image1Url: { type: String, default: "" },
    image2Url: { type: String, default: "" },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MaintenanceAuditSubmission", MaintenanceAuditSubmissionSchema);
