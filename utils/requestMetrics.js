// TEMP diagnostic utility — remove after the measurement window. Vercel's
// own dashboard can't split Active CPU by internal route (this whole app is
// one Vercel Function), so this counts, per day, how many thumbnail
// resizes / PDF generations / cold starts happen and how much wall-clock
// time each one took — a fire-and-forget write that never blocks or can
// fail the real request it's attached to.
const mongoose = require("mongoose");

const RequestMetricSchema = new mongoose.Schema(
  {
    date: String,
    type: String,
    count: { type: Number, default: 0 },
    totalMs: { type: Number, default: 0 },
  },
  { timestamps: true }
);
RequestMetricSchema.index({ date: 1, type: 1 }, { unique: true });

const RequestMetric = mongoose.models.RequestMetric || mongoose.model("RequestMetric", RequestMetricSchema);

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function recordMetric(type, ms = 0) {
  RequestMetric.updateOne({ date: todayKey(), type }, { $inc: { count: 1, totalMs: ms } }, { upsert: true }).catch(() => {});
}

module.exports = { recordMetric, RequestMetric };
