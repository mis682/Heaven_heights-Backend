const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// India has no DST, so a fixed +05:30 offset always gives the correct IST
// wall-clock day boundary regardless of the server's own OS timezone
// (Render's containers run in UTC) — using the server-local Date
// constructor here would silently compute UTC-day boundaries instead,
// misfiling any entry captured between IST midnight and 5:30 AM.
function istDayStart(dateStr) {
  return new Date(`${dateStr}T00:00:00+05:30`);
}

// A caller with neither dateFrom nor dateTo set (a fresh page load before
// anyone picks a filter) used to mean "no filter at all" — every submission
// ever recorded got pulled from Atlas on every visit to these list pages,
// which several coordinators reload many times a day. Falling back to a
// recent rolling window instead keeps a first load fast and bounded; anyone
// who actually wants older records can still ask for them explicitly via
// dateFrom/dateTo.
const DEFAULT_RANGE_DAYS = 30;

function buildIstDateRangeFilter(dateFrom, dateTo) {
  const range = {};
  if (dateFrom) range.$gte = istDayStart(dateFrom);
  if (dateTo) range.$lt = new Date(istDayStart(dateTo).getTime() + DAY_MS);
  if (Object.keys(range).length) return range;

  return { $gte: new Date(Date.now() - DEFAULT_RANGE_DAYS * DAY_MS) };
}

// "YYYY-MM-DD" for the IST calendar day a timestamp falls on — shifting the
// instant by the IST offset before formatting in UTC yields the IST wall-clock
// date without depending on the server's own timezone.
function istDateKey(date) {
  return new Date(new Date(date).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

// IST wall-clock hour (0-23) for a timestamp, same offset trick as above.
function istHour(date) {
  return new Date(new Date(date).getTime() + IST_OFFSET_MS).getUTCHours();
}

module.exports = { istDayStart, buildIstDateRangeFilter, istDateKey, istHour };
