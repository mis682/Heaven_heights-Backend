const mongoose = require("mongoose");

const RoleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    permissions: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Only ever true for "Admin" — the bypass-all, lockout-protected role.
    // Blocks rename/delete so server/middleware/auth.js's `role === "Admin"`
    // checks can stay simple string comparisons.
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Role", RoleSchema);
