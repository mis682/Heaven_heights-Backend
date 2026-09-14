const mongoose = require("mongoose");

const CheckpointSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    checkpointId: { type: Number, required: true },
    name: { type: String, required: true, trim: true },
    order: { type: Number, required: true },
  },
  { timestamps: true }
);

CheckpointSchema.index({ projectId: 1, order: 1 });

module.exports = mongoose.model("Checkpoint", CheckpointSchema);
