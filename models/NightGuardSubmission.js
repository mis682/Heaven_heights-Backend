const mongoose = require("mongoose");

const NightGuardSubmissionSchema = new mongoose.Schema(
  {
    guardName: { type: String, required: true },
    projectName: { type: String, required: true },
    guardPhotoUrl: { type: String, required: true },
    capturedAt: { type: Date, required: true },
    geoLocation: {
      lat: Number,
      lng: Number,
      address: String,
    },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("NightGuardSubmission", NightGuardSubmissionSchema);
