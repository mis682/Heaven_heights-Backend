const mongoose = require("mongoose");

const SiteLocationSchema = new mongoose.Schema(
  {
    siteName: { type: String, required: true, unique: true, trim: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    radiusMeters: { type: Number, default: 500 },
    // Lets a site's geofence be paused without losing the saved
    // latitude/longitude/radius, so re-enabling it later restores the exact
    // same location instead of requiring it to be set again.
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SiteLocation", SiteLocationSchema);
