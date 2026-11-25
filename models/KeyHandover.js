const mongoose = require("mongoose");

// Same gate-register pattern as MaintenanceStaffInOut: In-Time is filled in
// at submission time, Out-Time starts empty and is filled in later by the
// coordinator once the vehicle key is handed back, from the Submissions page.
const KeyHandoverSchema = new mongoose.Schema(
  {
    vehicle: { type: String, required: true, enum: ["Car", "EV"] },
    date: { type: String, required: true },
    driverName: { type: String, required: true, enum: ["Neeraj", "Manoj", "Dharmendra"] },
    inTime: { type: String, required: true },
    outTime: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("KeyHandover", KeyHandoverSchema);
