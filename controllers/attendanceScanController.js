const ExcelJS = require("exceljs");
const MaintenanceStaff = require("../models/MaintenanceStaff");
const SiteLocation = require("../models/SiteLocation");
const AttendanceScan = require("../models/AttendanceScan");
const AttendanceOverride = require("../models/AttendanceOverride");
const { fileToUrl } = require("../middleware/upload");
const { haversineMeters } = require("../utils/geo");
const { buildTeamAttendancePdf } = require("../utils/teamAttendancePdf");
const { istDateKey, istHour, istDayStart } = require("../utils/istDateRange");
const { notifyWebhook } = require("../utils/webhook");

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function presentPercent(days) {
  const relevant = days.filter((d) => d.status);
  if (!relevant.length) return 0;
  return Math.round((relevant.filter((d) => d.status === "P").length / relevant.length) * 100);
}

function statusTotals(days) {
  return {
    totalPresent: days.filter((d) => d.status === "P").length,
    totalAbsent: days.filter((d) => d.status === "A").length,
    totalHalfDay: days.filter((d) => d.status === "HD").length,
    totalSinglePunch: days.filter((d) => d.status === "SP").length,
  };
}

// A night shift open with an "in" scan is treated as still open (its next
// scan is the matching "out") as long as it's within this many hours —
// covers shifts that punch in one evening and out the next morning, crossing
// an IST calendar-day boundary. Past this, an old unclosed "in" is treated
// as abandoned and the next scan starts fresh. Day/unspecified-shift staff
// don't use an hours window at all (see determineNextPunch) — a flat elapsed
// number can't tell a legitimate long day apart from a guard who forgot to
// punch in one morning, scanned only once that evening, and is now starting
// a genuinely new day: both land in roughly the same 12-14h range.
const NIGHT_SHIFT_RESET_HOURS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

const toDateKey = istDateKey;

// Noon is the pivot for guessing what a "fresh chain" scan (no open "in" to
// pair with) actually means, per shift:
// - Night shift, before noon: a night runs ~9 PM-6 AM, so a fresh scan this
//   early is never someone starting a new shift — it's a guard who forgot to
//   punch in the previous evening and is only scanning once, at the end of
//   the night. Treated as that night's punch-out (dated to the night it
//   started, i.e. yesterday).
// - Day shift, noon or after: a day shift starts in the morning, so a fresh
//   scan this late is never a genuine start — it's a guard who forgot the
//   morning punch-in and is only scanning once, at the end of the day.
//   Treated as today's punch-out instead of a same-day punch-in (which would
//   otherwise wrongly swallow tomorrow's real punch-in as its matching out).
// Both cases show correctly as Punch Out / Single Punch instead of starting
// a bogus open shift that the next real scan then incorrectly closes.
const CATCHUP_NOON_HOUR = 12;

// Determines whether this scan is a punch-in or punch-out, and which day's
// shift it belongs to. An "out" inherits the "in" scan's shiftDate, so a
// night shift that crosses midnight still counts as one day's attendance —
// the day the guard punched IN, not the day they punched out.
function determineNextPunch(lastRecord, shift) {
  const now = new Date();

  if (shift === "night") {
    const freshChain =
      !lastRecord ||
      lastRecord.type === "out" ||
      (now - new Date(lastRecord.timestamp)) / 3600000 > NIGHT_SHIFT_RESET_HOURS;

    if (freshChain) {
      // If the last record is itself a recent "out", that night has already
      // been closed moments ago — this new scan can't be its forgotten
      // closing punch too, so skip the catch-up guess and treat it as a
      // plain new punch-in. Without this, a guard who scans twice in a row
      // right after closing out has the second scan wrongly re-classified
      // as another "out" for the previous night instead of the new night's
      // punch-in.
      const justClosedShift =
        lastRecord && lastRecord.type === "out" && (now - new Date(lastRecord.timestamp)) / 3600000 < NIGHT_SHIFT_RESET_HOURS;

      if (!justClosedShift && istHour(now) < CATCHUP_NOON_HOUR) {
        const yesterday = new Date(now.getTime() - 24 * 3600000);
        return { type: "out", shiftDate: toDateKey(yesterday) };
      }
      return { type: "in", shiftDate: toDateKey(now) };
    }
    return { type: "out", shiftDate: lastRecord.shiftDate || toDateKey(lastRecord.timestamp) };
  }

  // Day shift / unspecified: pairing is scoped to the IST calendar day
  // instead of an elapsed-hours window. A day shift never legitimately
  // crosses midnight, so any scan on a different calendar day from the open
  // "in" always starts a fresh "in" — no matter how few hours have passed
  // (e.g. forgot the morning punch-in, scanned only once that evening; the
  // next morning's scan must not be absorbed as that evening's "out"). Within
  // the same calendar day, an open "in" pairs with the next scan as
  // "out" even on an unusually long day.
  const lastRecordDate = lastRecord && (lastRecord.shiftDate || toDateKey(lastRecord.timestamp));
  const freshChain = !lastRecord || lastRecord.type === "out" || lastRecordDate !== toDateKey(now);

  if (freshChain) {
    // See the night-shift comment above — same reasoning, applied to a
    // same-day "out" that was just recorded moments ago.
    const justClosedShift = lastRecord && lastRecord.type === "out" && lastRecordDate === toDateKey(now);

    if (!justClosedShift && shift === "day" && istHour(now) >= CATCHUP_NOON_HOUR) {
      return { type: "out", shiftDate: toDateKey(now) };
    }
    return { type: "in", shiftDate: toDateKey(now) };
  }
  return { type: "out", shiftDate: lastRecord.shiftDate || toDateKey(lastRecord.timestamp) };
}

// Guards and Electricians rotate between sites daily, so their assigned
// "home" site in the roster doesn't reflect where they're actually posted on
// a given day — the geofence check is skipped for them, but stays enforced
// for everyone else (housekeeping, gardeners, drivers, etc.) who work a
// fixed site.
const GEOFENCE_EXEMPT_DESIGNATIONS = ["securityguard", "electrician"];
function isGeofenceExempt(designation) {
  return GEOFENCE_EXEMPT_DESIGNATIONS.includes((designation || "").toLowerCase().replace(/\s+/g, ""));
}

exports.lookup = async (req, res) => {
  const staff = await MaintenanceStaff.findOne({ employeeId: req.params.employeeId });
  if (!staff) return res.status(404).json({ message: "Yeh QR code kisi bhi staff se match nahi hua" });

  const lastRecord = await AttendanceScan.findOne({ staff: staff._id }).sort({ timestamp: -1 });
  const { type: nextType } = determineNextPunch(lastRecord);

  res.json({
    staff: {
      _id: staff._id,
      employeeId: staff.employeeId,
      name: staff.name,
      designation: staff.designation,
      siteName: staff.siteName,
      photo: staff.photo,
    },
    nextType,
  });
};

exports.scan = async (req, res) => {
  const { employeeId, latitude, longitude, address, shift } = req.body;
  const staff = await MaintenanceStaff.findOne({ employeeId });
  if (!staff) return res.status(404).json({ message: "Yeh QR code kisi bhi staff se match nahi hua" });

  const lastRecord = await AttendanceScan.findOne({ staff: staff._id }).sort({ timestamp: -1 });
  const { type, shiftDate } = determineNextPunch(lastRecord, shift === "day" || shift === "night" ? shift : null);

  let distanceMeters = null;
  let withinGeofence = null;

  if (!isGeofenceExempt(staff.designation)) {
    const siteLocation = await SiteLocation.findOne({ siteName: staff.siteName });
    if (siteLocation && siteLocation.enabled !== false) {
      const hasCoords = latitude != null && longitude != null && latitude !== "" && longitude !== "";
      if (!hasCoords) {
        // A site with a configured lock must not silently skip the geofence
        // just because the device failed to hand back a location — that would
        // let anyone punch in/out from anywhere by denying location access.
        return res.status(400).json({
          message: "Location capture nahi ho payi — device ki location ON karke dobara try karein.",
        });
      }
      distanceMeters = haversineMeters(Number(latitude), Number(longitude), siteLocation.latitude, siteLocation.longitude);
      withinGeofence = distanceMeters <= siteLocation.radiusMeters;
      if (!withinGeofence) {
        return res.status(400).json({
          message: `Aap site se ${Math.round(distanceMeters)}m door hain — attendance sirf ${siteLocation.radiusMeters}m ke andar capture hoti hai.`,
          distanceMeters,
          withinGeofence,
        });
      }
    }
  }

  const record = await AttendanceScan.create({
    staff: staff._id,
    employeeId: staff.employeeId,
    name: staff.name,
    siteName: staff.siteName,
    type,
    shiftDate,
    shift: shift === "day" || shift === "night" ? shift : null,
    latitude: latitude != null && latitude !== "" ? Number(latitude) : undefined,
    longitude: longitude != null && longitude !== "" ? Number(longitude) : undefined,
    address,
    distanceMeters,
    withinGeofence,
    photo: req.file ? fileToUrl(req.file) : "",
  });

  const punchLabel = type === "in" ? "Punch In" : "Punch Out";
  const shiftLabel = record.shift === "night" ? " 🌙 Night Shift" : record.shift === "day" ? " ☀️ Day Shift" : "";
  const messageLines = [
    `🕐 *${staff.name}* (${staff.employeeId}) — ${punchLabel} at *${staff.siteName}*${shiftLabel}`,
    `${new Date(record.timestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}${
      withinGeofence ? " — 📍 On site" : ""
    }${address ? `\n${address}` : ""}`,
  ];
  if (record.photo) {
    messageLines.push("", record.photo);
  }

  notifyWebhook(
    {
      type: "attendance_scan",
      channel: "attendance-log",
      employeeId: staff.employeeId,
      staffName: staff.name,
      siteName: staff.siteName,
      punchType: type,
      shift: record.shift,
      timestamp: record.timestamp,
      photoUrl: record.photo,
      message: messageLines.join("\n"),
    },
    "N8N_ATTENDANCE_WEBHOOK_URL"
  );

  res.status(201).json({
    type,
    staffName: staff.name,
    timestamp: record.timestamp,
    distanceMeters,
    withinGeofence,
  });
};

exports.records = async (req, res) => {
  const { siteName, search, date } = req.query;
  const filter = {};
  if (siteName) filter.siteName = siteName;
  if (search) {
    const re = new RegExp(search, "i");
    filter.$or = [{ name: re }, { employeeId: re }, { siteName: re }];
  }
  if (date) {
    // The Date column shown to coordinators is each record's shiftDate, not
    // its raw scan time — an overnight shift's punch-out can physically
    // happen a day later than the day it's attributed to. Query a window
    // wide enough to catch that, then filter precisely by the same
    // shiftDate (falling back to the IST calendar day for older records
    // from before shiftDate existed) so the filter matches what's displayed.
    const dayStart = istDayStart(date).getTime();
    filter.timestamp = { $gte: new Date(dayStart - DAY_MS), $lt: new Date(dayStart + 2 * DAY_MS) };
  }
  let records = await AttendanceScan.find(filter).sort({ timestamp: -1 }).limit(date ? 2000 : 500);
  if (date) {
    records = records.filter((r) => (r.shiftDate || istDateKey(r.timestamp)) === date).slice(0, 500);
  }
  res.json(records);
};

// First scan of the day = punch in, last scan = punch out, everything in
// between is ignored. Status is derived from the resulting duration:
// 0 scans -> Absent, 1 scan -> Single Punch, <4h -> Absent,
// 4h-6h -> Half Day, >6h -> Present.
async function computeMonthSummary({ month, year, search }) {
  const y = Number(year);
  const m = Number(month);
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 0, 23, 59, 59, 999);
  const daysInMonth = end.getDate();

  const staffFilter = {};
  if (search) {
    const re = new RegExp(search, "i");
    staffFilter.$or = [{ name: re }, { employeeId: re }, { siteName: re }];
  }
  const staffList = await MaintenanceStaff.find(staffFilter).sort({ employeeId: 1 });

  // Widen the raw query by a day on each side so a night shift that punches
  // in on the last evening of one month and out early the next month (or
  // vice versa) is still fetched — it's then bucketed by shiftDate below,
  // not by the query window.
  const queryStart = new Date(start.getTime() - 24 * 3600000);
  const queryEnd = new Date(end.getTime() + 24 * 3600000);
  const scans = await AttendanceScan.find({ timestamp: { $gte: queryStart, $lte: queryEnd } }).sort({ timestamp: 1 });

  const monthPrefix = `${y}-${String(m).padStart(2, "0")}`;
  const byStaffDay = new Map();
  scans.forEach((s) => {
    const shiftDate = s.shiftDate || toDateKey(s.timestamp);
    if (!shiftDate.startsWith(monthPrefix)) return;
    const day = Number(shiftDate.slice(-2));
    const key = `${s.employeeId}__${day}`;
    if (!byStaffDay.has(key)) byStaffDay.set(key, []);
    byStaffDay.get(key).push(s);
  });

  // HR corrections take precedence over whatever the raw scans compute —
  // the scans themselves aren't touched, just the displayed/exported status.
  const overrides = await AttendanceOverride.find({ date: { $regex: `^${monthPrefix}` } });
  const overrideByStaffDay = new Map(overrides.map((o) => [`${o.employeeId}__${o.date}`, o]));

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === y && today.getMonth() + 1 === m;
  const lastRelevantDay = isCurrentMonth ? today.getDate() : daysInMonth;

  const rows = staffList.map((staff) => {
    const days = [];
    for (let day = 1; day <= daysInMonth; day++) {
      if (day > lastRelevantDay) {
        days.push({ day, status: null });
        continue;
      }
      const dayScans = byStaffDay.get(`${staff.employeeId}__${day}`) || [];
      let dayResult;
      if (dayScans.length === 0) {
        dayResult = { day, status: "A", totalHours: 0 };
      } else if (dayScans.length === 1) {
        const t = dayScans[0].timestamp;
        dayResult = { day, status: "SP", punchIn: t, punchOut: t, totalHours: 0 };
      } else {
        const punchIn = dayScans[0].timestamp;
        const punchOut = dayScans[dayScans.length - 1].timestamp;
        const hours = (new Date(punchOut) - new Date(punchIn)) / 3600000;
        let status;
        if (hours < 4) status = "A";
        else if (hours <= 6) status = "HD";
        else status = "P";
        dayResult = { day, status, punchIn, punchOut, totalHours: Math.round(hours * 100) / 100 };
      }
      const dateKey = `${monthPrefix}-${String(day).padStart(2, "0")}`;
      const override = overrideByStaffDay.get(`${staff.employeeId}__${dateKey}`);
      if (override) {
        dayResult = { ...dayResult, status: override.status, overridden: true, setBy: override.setBy };
      }
      days.push(dayResult);
    }
    return {
      employeeId: staff.employeeId,
      name: staff.name,
      siteName: staff.siteName,
      designation: staff.designation,
      companyName: staff.companyName || "",
      photo: staff.photo,
      days,
    };
  });

  return { daysInMonth, rows, month: m, year: y };
}

exports.monthSummary = async (req, res) => {
  const summary = await computeMonthSummary(req.query);
  res.json(summary);
};

exports.setAttendanceOverride = async (req, res) => {
  const { employeeId, date, status, setBy } = req.body;
  if (!employeeId || !date || !status) {
    return res.status(400).json({ message: "employeeId, date and status are required" });
  }
  const override = await AttendanceOverride.findOneAndUpdate(
    { employeeId, date },
    { status, setBy: setBy || "" },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.json(override);
};

exports.clearAttendanceOverride = async (req, res) => {
  const { employeeId, date } = req.query;
  if (!employeeId || !date) {
    return res.status(400).json({ message: "employeeId and date are required" });
  }
  await AttendanceOverride.deleteOne({ employeeId, date });
  res.json({ message: "Override cleared" });
};

exports.exportTeamAttendanceExcel = async (req, res) => {
  const { daysInMonth, rows, month, year } = await computeMonthSummary(req.query);

  const FILL = { P: "FF22C55E", A: "FFEF4444", HD: "FF3B82F6", SP: "FFF59E0B" };

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`Attendance ${MONTH_NAMES[month - 1]} ${year}`);
  const columns = [
    { header: "Name", key: "name", width: 24 },
    { header: "Company", key: "companyName", width: 30 },
    { header: "Employee ID", key: "employeeId", width: 14 },
    { header: "Site", key: "siteName", width: 22 },
    { header: "Present %", key: "presentPercent", width: 10 },
    { header: "Total Present", key: "totalPresent", width: 12 },
    { header: "Total Absent", key: "totalAbsent", width: 12 },
    { header: "Total Half Day", key: "totalHalfDay", width: 13 },
    { header: "Total Single Punch", key: "totalSinglePunch", width: 15 },
  ];
  const fixedColumnCount = columns.length;
  for (let d = 1; d <= daysInMonth; d += 1) columns.push({ header: String(d), key: `day${d}`, width: 5 });
  sheet.columns = columns;

  rows.forEach((row) => {
    const totals = statusTotals(row.days);
    const rowData = {
      name: row.name,
      companyName: row.companyName,
      employeeId: row.employeeId,
      siteName: row.siteName,
      presentPercent: `${presentPercent(row.days)}%`,
      ...totals,
    };
    row.days.forEach((d) => {
      rowData[`day${d.day}`] = d.status || "";
    });
    const excelRow = sheet.addRow(rowData);
    row.days.forEach((d, idx) => {
      if (!d.status) return;
      const cell = excelRow.getCell(fixedColumnCount + 1 + idx);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILL[d.status] } };
      cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
      cell.alignment = { horizontal: "center" };
    });
  });
  sheet.getRow(1).font = { bold: true };

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=team-attendance-${year}-${String(month).padStart(2, "0")}.xlsx`
  );
  await workbook.xlsx.write(res);
  res.end();
};

exports.exportTeamAttendancePdf = async (req, res) => {
  const { daysInMonth, rows, month, year } = await computeMonthSummary(req.query);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=team-attendance-${year}-${String(month).padStart(2, "0")}.pdf`
  );

  const doc = buildTeamAttendancePdf({
    daysInMonth,
    rows: rows.map((r) => ({ ...r, presentPercent: presentPercent(r.days), ...statusTotals(r.days) })),
    monthLabel: `${MONTH_NAMES[month - 1]} ${year}`,
  });
  doc.pipe(res);
  doc.end();
};

exports.remove = async (req, res) => {
  const record = await AttendanceScan.findByIdAndDelete(req.params.id);
  if (!record) return res.status(404).json({ message: "Record not found" });
  res.json({ message: "Attendance record deleted" });
};
