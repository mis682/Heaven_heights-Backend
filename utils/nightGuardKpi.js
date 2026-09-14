const NightGuardSubmission = require("../models/NightGuardSubmission");

// Night Guard has no distinct "checkpoints" the way Patrol does — a guard
// is just expected to submit one proof-of-presence photo roughly every hour
// for as long as their shift runs, so there's no fixed per-shift checklist
// size to compare against either. Instead of anchoring on a round's start
// and a known checkpoint count, this looks at the gap between each pair of
// consecutive submissions in a guard's stream at one site: a gap of an hour
// or less is one on-time check-in; a longer gap means that check-in came in
// late, and every whole hour skipped in between is a separate missed
// check-in. A gap of more than SHIFT_BREAK_HOURS is treated as the shift
// having ended rather than a string of misses — the guard going home at 6
// AM and returning at 9 PM isn't 15 missed hourly check-ins.
const HOUR_WINDOW_MINUTES = 60;
const SHIFT_BREAK_HOURS = 3;

async function computeNightGuardKpi({ from, to }) {
  const rangeStart = new Date(`${from}T00:00:00+05:30`);
  const rangeEnd = new Date(`${to}T23:59:59.999+05:30`);
  // A trailing buffer so a shift that starts near the end of the range has
  // later check-ins available to judge its own cadence against.
  const fetchEnd = new Date(rangeEnd.getTime() + 9 * 60 * 60 * 1000);

  const docs = await NightGuardSubmission.find({ capturedAt: { $gte: rangeStart, $lt: fetchEnd } })
    .select("guardName projectName capturedAt")
    .sort({ capturedAt: 1 });

  // A guard's cadence only makes sense within one site at a time.
  const byGuardSite = new Map();
  docs.forEach((d) => {
    const key = `${d.guardName}::${d.projectName}`;
    if (!byGuardSite.has(key)) byGuardSite.set(key, []);
    byGuardSite.get(key).push(d.capturedAt);
  });

  const byGuard = new Map();

  byGuardSite.forEach((times, key) => {
    const [guardName] = key.split("::");
    if (!byGuard.has(guardName)) {
      byGuard.set(guardName, { total: 0, onTime: 0, late: 0, noPhoto: 0, lateDetails: [] });
    }
    const bucket = byGuard.get(guardName);

    times.forEach((t, i) => {
      const inRange = t >= rangeStart && t <= rangeEnd;
      if (i === 0) {
        // The first submission of a stream starts a shift — nothing before
        // it to be late against.
        if (inRange) {
          bucket.total += 1;
          bucket.onTime += 1;
        }
        return;
      }

      const gapMinutes = (t - times[i - 1]) / 60000;
      if (gapMinutes > SHIFT_BREAK_HOURS * 60) {
        // A new shift starts here instead of a continuation.
        if (inRange) {
          bucket.total += 1;
          bucket.onTime += 1;
        }
        return;
      }

      if (!inRange) return;

      if (gapMinutes <= HOUR_WINDOW_MINUTES) {
        bucket.total += 1;
        bucket.onTime += 1;
      } else {
        const missedHours = Math.floor(gapMinutes / HOUR_WINDOW_MINUTES) - 1;
        for (let m = 0; m < missedHours; m += 1) {
          bucket.total += 1;
          bucket.noPhoto += 1;
          bucket.lateDetails.push({ before: t, lateByMinutes: null });
        }
        bucket.total += 1;
        bucket.late += 1;
        bucket.lateDetails.push({ before: t, lateByMinutes: Math.round(gapMinutes - HOUR_WINDOW_MINUTES) });
      }
    });
  });

  const rows = [...byGuard.entries()].map(([guardName, b]) => ({
    guardName,
    total: b.total,
    onTime: b.onTime,
    late: b.late,
    noPhoto: b.noPhoto,
    onTimePercent: b.total > 0 ? Math.round((b.onTime / b.total) * 100) : 0,
    lateDetails: b.lateDetails,
  }));
  rows.sort((a, b) => a.guardName.localeCompare(b.guardName));
  return rows;
}

module.exports = { computeNightGuardKpi };
