const mongoose = require("mongoose");

const GuardSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    siteName: { type: String, required: true, trim: true },
    module: {
      type: String,
      enum: ["patrol_checkpoint", "night_guard", "pending"],
      required: true,
    },
    formActive: { type: Boolean, default: false },
  },
  { timestamps: true }
);

GuardSchema.index({ siteName: 1, module: 1 });

module.exports = mongoose.model("Guard", GuardSchema);
