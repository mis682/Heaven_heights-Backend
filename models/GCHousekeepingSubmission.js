const mongoose = require("mongoose");

const GCHousekeepingSubmissionSchema = new mongoose.Schema(
  {
    formNumber: { type: Number, required: true, enum: [1, 2, 3, 4] },
    submittedBy: { type: String, required: true, trim: true },
    submittedAt: { type: Date, default: Date.now },
    // Photos upload one at a time as they're captured (see addPhoto in the
    // controller), so a submission sits at "in_progress" the whole time a
    // guard is working through checkpoints — only flips to "submitted" once
    // every checkpoint has a photo and they hit Submit. This means a killed
    // tab/interrupted call never loses anything already uploaded; only the
    // remaining checkpoints need retaking.
    status: { type: String, enum: ["in_progress", "submitted"], default: "in_progress" },
    photos: [
      {
        checkpointId: { type: Number, required: true },
        photoUrl: { type: String, required: true },
        capturedAt: Date,
        geoLocation: {
          lat: Number,
          lng: Number,
          address: String,
        },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("GCHousekeepingSubmission", GCHousekeepingSubmissionSchema);
