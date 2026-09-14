const mongoose = require("mongoose");

const PhotoEntrySchema = new mongoose.Schema(
  {
    checkpointId: { type: Number, required: true },
    photoUrl: { type: String, required: true },
    capturedAt: { type: Date, required: true },
    geoLocation: {
      lat: Number,
      lng: Number,
      address: String,
    },
  },
  { _id: false }
);

const PatrolSubmissionSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    projectName: { type: String, required: true },
    guardName: { type: String, required: true },
    submittedAt: { type: Date, default: Date.now },
    photos: [PhotoEntrySchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("PatrolSubmission", PatrolSubmissionSchema);
