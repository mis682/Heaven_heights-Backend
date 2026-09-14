const mongoose = require("mongoose");

const EmployeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    employeeId: { type: String, trim: true },
    phone: { type: String, trim: true },
    department: {
      type: String,
      enum: ["Housekeeping", "Guard", "Admin"],
      required: true,
    },
    role: { type: String, trim: true, default: "" },
    photo: { type: String, default: "" },
    shiftStart: { type: String, default: "09:00" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Employee", EmployeeSchema);
