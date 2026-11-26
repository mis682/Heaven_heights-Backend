const mongoose = require("mongoose");

const SilverEstateOfficeSubmissionSchema = new mongoose.Schema(
  {
    formNumber: { type: Number, required: true },
    submittedBy: { type: String, required: true, trim: true },
    submittedAt: { type: Date, default: Date.now },
    photos: [
      {
        checkpointLabel: { type: String, required: true },
        photoUrl: { type: String, required: true },
        capturedAt: Date,
        geoLocation: {
          lat: Number,
          lng: Number,
          address: String,
        },
      },
    ],
    // No text/select-type checkpoints in this module's form today, but kept
    // for the same reason as every other housekeeping module — consistent
    // shape if one is ever added.
    textAnswers: [
      {
        label: { type: String, required: true },
        value: { type: String, default: "" },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("SilverEstateOfficeSubmission", SilverEstateOfficeSubmissionSchema);
