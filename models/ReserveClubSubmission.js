const mongoose = require("mongoose");

const ReserveClubSubmissionSchema = new mongoose.Schema(
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
    // Some checkpoints are a short text answer instead of a photo.
    textAnswers: [
      {
        label: { type: String, required: true },
        value: { type: String, default: "" },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("ReserveClubSubmission", ReserveClubSubmissionSchema);
