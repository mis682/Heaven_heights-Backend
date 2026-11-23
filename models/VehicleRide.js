const mongoose = require("mongoose");

// One row per Daily Basis Ride submission — distance for that ride is
// derived (endReading - startReading), not stored, so it can never drift
// out of sync with the two readings it comes from.
const VehicleRideSchema = new mongoose.Schema(
  {
    vehicleName: { type: String, required: true, enum: ["TATA EV", "Honda City"] },
    date: { type: String, required: true }, // "YYYY-MM-DD"
    startReading: { type: Number, required: true },
    endReading: { type: Number, required: true },
    reason: { type: String, required: true, trim: true },
    personName: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

VehicleRideSchema.index({ vehicleName: 1, date: 1 });

module.exports = mongoose.model("VehicleRide", VehicleRideSchema);
