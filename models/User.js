const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    phone: { type: String, trim: true, default: "" },
    employeeId: { type: String, trim: true, default: "" },
    designation: { type: String, trim: true, default: "" },
    department: { type: String, trim: true, default: "" },
    // Validity checked against the Role collection in userController, not a
    // static enum, since roles are now admin-editable DB records.
    role: { type: String, required: true, trim: true },
    permissions: { type: mongoose.Schema.Types.Mixed, default: {} },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
