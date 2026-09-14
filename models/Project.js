const mongoose = require("mongoose");

const ProjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    module: {
      type: String,
      enum: ["patrol_checkpoint", "night_guard", "pending"],
      required: true,
    },
    checkpointCount: { type: Number, default: 0 },
    formActive: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Project", ProjectSchema);
