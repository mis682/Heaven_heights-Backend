const mongoose = require("mongoose");

const MaintenanceUniformSubmissionSchema = new mongoose.Schema(
  {
    siteName: { type: String, required: true },
    designation: { type: String, required: true },
    staffName: { type: String, required: true, trim: true },
    shift: { type: String, enum: ["Day", "Night"], required: true },
    photoUrl: { type: String, required: true },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

MaintenanceUniformSubmissionSchema.index({ submittedAt: -1 });

module.exports = mongoose.model("MaintenanceUniformSubmission", MaintenanceUniformSubmissionSchema);
