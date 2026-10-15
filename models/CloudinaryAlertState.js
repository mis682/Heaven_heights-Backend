const mongoose = require("mongoose");

// A single document tracks the highest usage threshold we've already
// emailed about, so the periodic check doesn't resend the same warning
// every cycle — only when usage climbs past a new threshold (or drops back
// down, e.g. after Cloudinary's monthly bandwidth/transformation reset, at
// which point thresholds re-arm).
const CloudinaryAlertStateSchema = new mongoose.Schema(
  {
    lastAlertedThreshold: { type: Number, default: 0 },
    lastAlertedAt: { type: Date, default: null },
    lastUsedPercent: { type: Number, default: 0 },
    // Index into middleware/upload.js's CLOUDINARY_ACCOUNTS chain (0 =
    // Primary) that new "main" uploads currently go to. Advances a tier
    // when the active account's usage crosses FALLBACK_THRESHOLD, and jumps
    // straight back to 0 as soon as Primary's own usage recovers (e.g. the
    // monthly reset) regardless of which tier was active.
    activeAccountIndex: { type: Number, default: 0 },
    // Last 20 times a tier's usage() check failed outright (network blip,
    // timeout, or Cloudinary erroring on that cloud_name) rather than
    // actually crossing FALLBACK_THRESHOLD — a failed check is still treated
    // as "unhealthy" (see upload.js/cloudinaryUsageAlert.js) so a bad
    // account can't strand uploads, but that means a tier can get skipped
    // for a one-off blip, not a real usage problem. Logged here so that's
    // diagnosable after the fact instead of silently swallowed.
    recentHealthCheckFailures: [
      {
        account: String,
        error: String,
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("CloudinaryAlertState", CloudinaryAlertStateSchema);
