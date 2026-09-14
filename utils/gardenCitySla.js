const PatrolSubmission = require("../models/PatrolSubmission");
const { GARDEN_CITY_SCHEDULE } = require("../constants/gardenCitySchedule");

// A checkpoint is "On Time" if the guard's photo was taken within this many
// minutes of its scheduled time; anything later is "Late by X min". Early is
// always On Time — guards aren't penalized for getting there ahead of time.
const LATE_THRESHOLD_MINUTES = 15;

function addDaysToDateKey(dateKey, days) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

// The schedule runs one continuous night, 7 PM through ~6:30 AM — PM slots
// belong to reportDate itself, AM slots land after midnight so they belong
// to reportDate + 1, even though the whole night is still "reportDate"'s
// shift/report.
function scheduleTimeToDate(reportDate, timeStr) {
  const match = timeStr.match(/^(\d{2}):(\d{2}):(\d{2}) (AM|PM)$/);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const [, , minute, second, ampm] = match;
  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  const dateKey = ampm === "AM" ? addDaysToDateKey(reportDate, 1) : reportDate;
  const hh = String(hour).padStart(2, "0");
  return new Date(`${dateKey}T${hh}:${minute}:${second}+05:30`);
}

function checkpointNumber(checkpointLabel) {
  return parseInt(checkpointLabel.replace(/^C-/, ""), 10);
}

// Fetches every checkpoint photo Garden City guards captured during the
// given night (reportDate 6 PM through reportDate+1 8 AM — a bit wider than
// the 7 PM-6:30 AM schedule itself, to tolerate an early/late outlier scan).
async function fetchNightSubmissions(reportDate) {
  const rangeStart = new Date(`${reportDate}T18:00:00+05:30`);
  const rangeEnd = new Date(`${addDaysToDateKey(reportDate, 1)}T08:00:00+05:30`);

  const docs = await PatrolSubmission.find({
    projectName: "Garden City",
    "photos.capturedAt": { $gte: rangeStart, $lt: rangeEnd },
  }).select("guardName photos");

  const photos = [];
  docs.forEach((doc) => {
    doc.photos.forEach((p) => {
      if (p.capturedAt >= rangeStart && p.capturedAt < rangeEnd) {
        photos.push({ checkpointId: p.checkpointId, capturedAt: p.capturedAt, guardName: doc.guardName });
      }
    });
  });
  return photos;
}

// Pairs each scheduled (checkpoint, time) slot with the guard's actual
// capture for that round. Rather than matching each slot to its single
// nearest-in-time photo (which can double-claim one photo for two nearby
// slots, since the same checkpoint recurs many times a night), both the
// schedule's and the actual submissions' times are sorted per checkpoint and
// paired in order — round 1 with round 1, round 2 with round 2, etc. Any
// slot with no corresponding photo is "no_photo"; extra photos beyond the
// scheduled count for that checkpoint are ignored.
async function computeGardenCitySla(reportDate) {
  const submissions = await fetchNightSubmissions(reportDate);

  const actualsByCheckpoint = new Map();
  submissions.forEach((s) => {
    if (!actualsByCheckpoint.has(s.checkpointId)) actualsByCheckpoint.set(s.checkpointId, []);
    actualsByCheckpoint.get(s.checkpointId).push(s);
  });
  actualsByCheckpoint.forEach((arr) => arr.sort((a, b) => a.capturedAt - b.capturedAt));

  const scheduleByCheckpoint = new Map();
  GARDEN_CITY_SCHEDULE.forEach((slot, idx) => {
    const num = checkpointNumber(slot.checkpointLabel);
    if (!scheduleByCheckpoint.has(num)) scheduleByCheckpoint.set(num, []);
    scheduleByCheckpoint.get(num).push({ idx, scheduledAt: scheduleTimeToDate(reportDate, slot.time) });
  });
  scheduleByCheckpoint.forEach((arr) => arr.sort((a, b) => a.scheduledAt - b.scheduledAt));

  const resultByIndex = new Array(GARDEN_CITY_SCHEDULE.length).fill(null);

  scheduleByCheckpoint.forEach((slots, num) => {
    const actuals = actualsByCheckpoint.get(num) || [];
    slots.forEach((slot, i) => {
      const actual = actuals[i];
      if (!actual) {
        resultByIndex[slot.idx] = { slaStatus: "no_photo" };
        return;
      }
      const diffMinutes = Math.round((actual.capturedAt - slot.scheduledAt) / 60000);
      const late = diffMinutes > LATE_THRESHOLD_MINUTES;
      resultByIndex[slot.idx] = {
        slaStatus: late ? "late" : "on_time",
        lateByMinutes: late ? diffMinutes : 0,
        actualCapturedAt: actual.capturedAt,
        actualGuardName: actual.guardName,
      };
    });
  });

  return resultByIndex;
}

module.exports = { computeGardenCitySla, addDaysToDateKey, LATE_THRESHOLD_MINUTES };
