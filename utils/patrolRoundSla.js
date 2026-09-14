const PatrolSubmission = require("../models/PatrolSubmission");
const PatrolDailyReport = require("../models/PatrolDailyReport");

// Each site's real, empirically-observed night-patrol window (checked
// against actual checkpoint-photo capture hours) — not the full 24-hour
// dropdown grid the Daily Report builder offers, which covers far more
// hours than guards actually patrol. Regal Garden/Wildflower/School use a
// plain hourly grid; Nature Park already has its own irregular round
// schedule (mirrors SITE_TIME_SLOTS in patrolReportController.js).
const NIGHT_SCHEDULES = {
  "regal-garden": { startHour: 21, endHour: 6 }, // 9 PM - 6 AM, hourly
  wildflower: { startHour: 21, endHour: 5 }, // 9 PM - 5 AM, hourly
  school: { startHour: 21, endHour: 5 }, // 9 PM - 5 AM, hourly
  "nature-park": {
    customBlocks: [
      { sh: 21, sm: 0, eh: 22, em: 30 },
      { sh: 22, sm: 30, eh: 23, em: 55 },
      { sh: 0, sm: 30, eh: 2, em: 0 },
      { sh: 2, sm: 0, eh: 3, em: 30 },
      { sh: 3, sm: 30, eh: 5, em: 0 },
      { sh: 5, sm: 30, eh: 7, em: 0 },
    ],
  },
};

function addDaysToDateKey(dateKey, days) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function toDate(dateKey, hour, minute) {
  return new Date(`${dateKey}T${pad(hour)}:${pad(minute)}:00+05:30`);
}

// Builds one night's fixed round windows, anchored to dateKey, correctly
// rolling AM hours (and Nature Park's custom AM blocks) onto dateKey + 1.
function buildNightRounds(dateKey, schedule) {
  const rounds = [];

  if (schedule.customBlocks) {
    let dayOffset = 0;
    let prevStartMinutes = -1;
    schedule.customBlocks.forEach((b) => {
      const startMinutes = b.sh * 60 + b.sm;
      if (startMinutes <= prevStartMinutes) dayOffset = 1;
      prevStartMinutes = startMinutes;
      const startDateKey = dayOffset === 0 ? dateKey : addDaysToDateKey(dateKey, dayOffset);
      const start = toDate(startDateKey, b.sh, b.sm);
      const endMinutes = b.eh * 60 + b.em;
      const endDateKey = endMinutes <= startMinutes ? addDaysToDateKey(startDateKey, 1) : startDateKey;
      const end = toDate(endDateKey, b.eh, b.em);
      rounds.push({ start, end });
    });
    return rounds;
  }

  let hour = schedule.startHour;
  let dayOffset = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const startDateKey = dayOffset === 0 ? dateKey : addDaysToDateKey(dateKey, dayOffset);
    const start = toDate(startDateKey, hour, 0);
    const nextHour = (hour + 1) % 24;
    const nextDayOffset = nextHour === 0 ? dayOffset + 1 : dayOffset;
    const endDateKey = nextDayOffset === 0 ? dateKey : addDaysToDateKey(dateKey, nextDayOffset);
    const end = toDate(endDateKey, nextHour, 0);
    rounds.push({ start, end });
    if (nextHour === schedule.endHour) break;
    hour = nextHour;
    dayOffset = nextDayOffset;
  }
  return rounds;
}

function istHour(date) {
  return new Date(date.getTime() + 5.5 * 60 * 60 * 1000).getUTCHours();
}

function parseSlotLabel(label) {
  const match = String(label || "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  return hour;
}

// A missed checkpoint has no photo at all, so there's no guard to credit it
// to directly — the closest available signal is who the coordinator's
// daily-report entries say was assigned to this site that night, picking
// whichever entry's own (unreliable-for-timing-but-still-indicative) label
// is closest in hour-of-day to the round that got missed.
function findAssignedGuard(entriesForDate, roundStart) {
  if (!entriesForDate || entriesForDate.length === 0) return null;
  const roundHour = istHour(roundStart);
  let best = null;
  let bestDiff = Infinity;
  entriesForDate.forEach((e) => {
    const hour = parseSlotLabel(e.timeSlot);
    if (hour == null) return;
    const diff = Math.min(Math.abs(hour - roundHour), 24 - Math.abs(hour - roundHour));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = e.guardName;
    }
  });
  return best;
}

// Guard KPI for a generic (non-Garden-City) patrol site, using each site's
// real fixed night-round schedule (NIGHT_SCHEDULES) rather than either a
// coordinator-typed label or a guard-relative "first checkpoint" anchor.
// For every date + fixed round + checkpoint: a photo within the round's own
// window is on time; not found there but found in a later round the same
// night is late; never found at all is missed (attributed to whichever
// guard the daily report shows was assigned closest to that round).
async function computeFixedHourGuardKpi({ projectId, projectSlug, from, to, checkpointCount }) {
  const schedule = NIGHT_SCHEDULES[projectSlug];
  if (!schedule) return [];

  const rangeStart = new Date(`${from}T00:00:00+05:30`);
  const fetchEnd = new Date(`${addDaysToDateKey(to, 2)}T00:00:00+05:30`);

  const docs = await PatrolSubmission.find({
    projectId,
    "photos.capturedAt": { $gte: rangeStart, $lt: fetchEnd },
  }).select("guardName photos");

  const byCheckpoint = new Map();
  docs.forEach((doc) => {
    doc.photos.forEach((p) => {
      if (p.capturedAt < rangeStart || p.capturedAt >= fetchEnd) return;
      if (!byCheckpoint.has(p.checkpointId)) byCheckpoint.set(p.checkpointId, []);
      byCheckpoint.get(p.checkpointId).push({ capturedAt: p.capturedAt, guardName: doc.guardName });
    });
  });
  byCheckpoint.forEach((arr) => arr.sort((a, b) => a.capturedAt - b.capturedAt));

  const reports = await PatrolDailyReport.find({ projectId, status: "submitted" }).select("entries");
  const entriesByDate = new Map();
  reports.forEach((r) => {
    r.entries.forEach((e) => {
      if (!entriesByDate.has(e.date)) entriesByDate.set(e.date, []);
      entriesByDate.get(e.date).push(e);
    });
  });

  const byGuard = new Map();
  const credit = (guardName, type, detail) => {
    const name = guardName || "Unassigned";
    if (!byGuard.has(name)) byGuard.set(name, { total: 0, onTime: 0, late: 0, noPhoto: 0, lateDetails: [] });
    const bucket = byGuard.get(name);
    bucket.total += 1;
    if (type === "onTime") bucket.onTime += 1;
    else if (type === "late") {
      bucket.late += 1;
      bucket.lateDetails.push(detail);
    } else {
      bucket.noPhoto += 1;
      bucket.lateDetails.push(detail);
    }
  };

  const now = new Date();

  for (let dateKey = from; dateKey <= to; dateKey = addDaysToDateKey(dateKey, 1)) {
    const rounds = buildNightRounds(dateKey, schedule);
    // A night that hasn't fully finished yet (still in progress, or hasn't
    // started at all) can't fairly be judged — an empty round is only ever
    // really "missed" once every later round that could have caught a late
    // photo has also already passed.
    if (rounds[rounds.length - 1].end > now) continue;

    const nightStart = rounds[0].start;
    const nightEnd = rounds[rounds.length - 1].end;

    for (let cp = 1; cp <= checkpointCount; cp += 1) {
      // Scoped to just this one night. Each round claims the EARLIEST
      // not-yet-claimed capture that happened before the next round takes
      // over (not simply "the i-th capture for the i-th round" by array
      // position) — so a single photo can only ever settle one round, and a
      // genuinely skipped early round doesn't shift every later round's
      // photo out of place. Plain index pairing broke exactly that case: if
      // round 1 was skipped, round 2's photo would slide into round 1's
      // slot, round 3's into round 2's, and so on, cascading a "missed" all
      // the way to the last round of the night even though its own photo
      // was genuinely taken on time.
      const captures = (byCheckpoint.get(cp) || [])
        .filter((c) => c.capturedAt >= nightStart && c.capturedAt < nightEnd)
        .map((c) => ({ ...c, used: false }));

      rounds.forEach((round, roundIdx) => {
        const boundary = roundIdx + 1 < rounds.length ? rounds[roundIdx + 1].start : nightEnd;
        const capture = captures.find((c) => !c.used && c.capturedAt < boundary);

        if (!capture) {
          const assignedGuard = findAssignedGuard(entriesByDate.get(dateKey), round.start);
          credit(assignedGuard, "missed", { date: dateKey, checkpointId: cp, roundStart: round.start, lateByMinutes: null });
          return;
        }

        capture.used = true;
        if (capture.capturedAt < round.end) {
          credit(capture.guardName, "onTime");
        } else {
          const lateByMinutes = Math.round((capture.capturedAt - round.end) / 60000);
          credit(capture.guardName, "late", { date: dateKey, checkpointId: cp, roundStart: round.start, lateByMinutes });
        }
      });
    }
  }

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

module.exports = { computeFixedHourGuardKpi };
