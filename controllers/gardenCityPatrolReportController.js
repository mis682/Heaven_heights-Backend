const ExcelJS = require("exceljs");
const GardenCityPatrolReport = require("../models/GardenCityPatrolReport");
const { GARDEN_CITY_SCHEDULE } = require("../constants/gardenCitySchedule");
const { STATUS_OPTIONS } = require("../constants/reportStatus");
const { buildGardenCityReportPdf } = require("../utils/gardenCityReportPdf");
const { computeGardenCitySla, addDaysToDateKey, LATE_THRESHOLD_MINUTES } = require("../utils/gardenCitySla");

exports.meta = async (req, res) => {
  res.json({ statusOptions: STATUS_OPTIONS, schedule: GARDEN_CITY_SCHEDULE });
};

// Compares each scheduled checkpoint's time against the guard's actual
// photo-capture time for that night — used by the Daily Report Builder to
// show an On Time/Late/No Photo badge per row, purely informational (it
// never changes what status the coordinator can pick).
exports.getSla = async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ message: "date is required" });
  const sla = await computeGardenCitySla(date);
  res.json({ sla, lateThresholdMinutes: LATE_THRESHOLD_MINUTES });
};

// Aggregates the same per-checkpoint SLA comparison across a date range,
// per guard — the "who's actually late" view. A checkpoint with a photo is
// credited to whoever's name is on that photo (the real guard, regardless
// of who the coordinator assigned); a checkpoint with no photo at all is
// credited to the coordinator's assignment instead, since that's the only
// name available to hold accountable for the miss.
exports.getGuardKpi = async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ message: "from and to are required" });

  const perGuard = new Map();
  const touch = (guardName) => {
    if (!guardName) return null;
    if (!perGuard.has(guardName)) {
      perGuard.set(guardName, { guardName, onTime: 0, late: 0, noPhoto: 0, lateDetails: [] });
    }
    return perGuard.get(guardName);
  };

  for (let date = from; date <= to; date = addDaysToDateKey(date, 1)) {
    const [sla, report] = await Promise.all([
      computeGardenCitySla(date),
      GardenCityPatrolReport.findOne({ reportDate: date }).select("entries"),
    ]);

    GARDEN_CITY_SCHEDULE.forEach((slot, idx) => {
      const info = sla[idx];
      if (!info) return;

      if (info.slaStatus === "no_photo") {
        const guard = touch(report?.entries?.[idx]?.guardName);
        if (guard) guard.noPhoto += 1;
        return;
      }

      const guard = touch(info.actualGuardName);
      if (!guard) return;
      if (info.slaStatus === "on_time") {
        guard.onTime += 1;
      } else {
        guard.late += 1;
        guard.lateDetails.push({
          date,
          checkpointLabel: slot.checkpointLabel,
          scheduledTime: slot.time,
          lateByMinutes: info.lateByMinutes,
        });
      }
    });
  }

  const rows = Array.from(perGuard.values())
    .map((g) => {
      const total = g.onTime + g.late + g.noPhoto;
      return { ...g, total, onTimePercent: total > 0 ? Math.round((g.onTime / total) * 100) : 0 };
    })
    .sort((a, b) => a.onTimePercent - b.onTimePercent);

  res.json({ from, to, lateThresholdMinutes: LATE_THRESHOLD_MINUTES, rows });
};

exports.getByDate = async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ message: "date is required" });
  const report = await GardenCityPatrolReport.findOne({ reportDate: date });
  if (!report) return res.json(null);
  res.json(report);
};

exports.saveDraft = async (req, res) => {
  const { reportDate, entries, preparedBy } = req.body;
  if (!reportDate) return res.status(400).json({ message: "reportDate is required" });

  const report = await GardenCityPatrolReport.findOneAndUpdate(
    { reportDate, status: "draft" },
    { reportDate, entries, preparedBy },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  res.json(report);
};

exports.submitReport = async (req, res) => {
  const report = await GardenCityPatrolReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });
  if (report.status === "submitted") return res.status(400).json({ message: "Report already submitted" });
  const hasAnyEntry = (report.entries || []).some((e) => e.guardName && e.status);
  if (!hasAnyEntry) return res.status(400).json({ message: "Fill at least one row before submitting" });

  report.status = "submitted";
  report.submittedAt = new Date();
  await report.save();
  res.json(report);
};

exports.unlockReport = async (req, res) => {
  const report = await GardenCityPatrolReport.findByIdAndUpdate(
    req.params.id,
    { status: "draft", submittedAt: null },
    { new: true }
  );
  if (!report) return res.status(404).json({ message: "Report not found" });
  res.json(report);
};

exports.getReport = async (req, res) => {
  const report = await GardenCityPatrolReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });
  res.json(report);
};

exports.listSubmitted = async (req, res) => {
  const { from, to } = req.query;
  const filter = { status: "submitted" };
  if (from || to) {
    filter.reportDate = {};
    if (from) filter.reportDate.$gte = from;
    if (to) filter.reportDate.$lte = to;
  }
  const reports = await GardenCityPatrolReport.find(filter).sort({ reportDate: -1 });
  const summarized = reports.map((r) => {
    const filled = r.entries.filter((e) => e.guardName && e.status);
    const guardSet = new Set(filled.map((e) => e.guardName));
    return {
      _id: r._id,
      reportDate: r.reportDate,
      preparedBy: r.preparedBy,
      guards: Array.from(guardSet),
      present: filled.filter((e) => e.status === "Present").length,
      absent: filled.filter((e) => e.status === "Absent").length,
      submittedAt: r.submittedAt,
    };
  });
  res.json(summarized);
};

const BAND_ARGB_COLORS = ["FFF4B6AA", "FFC7A6DD"];

function getBandArgbColors(entries) {
  const colors = [];
  let blockIndex = 0;
  entries.forEach((e, idx) => {
    if (idx > 0 && e.time === "07:00:00 PM") blockIndex += 1;
    colors.push(BAND_ARGB_COLORS[blockIndex % 2]);
  });
  return colors;
}

exports.exportExcel = async (req, res) => {
  const report = await GardenCityPatrolReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`GardenCity_${report.reportDate}`);
  sheet.columns = [
    { header: "Checkpoint & Time", key: "checkpointAndTime", width: 24 },
    { header: "Guard Name", key: "guardName", width: 24 },
    { header: "Date", key: "date", width: 14 },
    { header: "Status", key: "status", width: 16 },
  ];
  const bandColors = getBandArgbColors(report.entries);
  report.entries.forEach((e, idx) => {
    const row = sheet.addRow({
      checkpointAndTime: `${e.checkpointLabel} ${e.time}`,
      guardName: e.guardName,
      date: report.reportDate,
      status: e.status,
    });
    row.getCell("checkpointAndTime").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: bandColors[idx] },
    };
  });
  sheet.getRow(1).font = { bold: true };

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=garden-city-report-${report.reportDate}.xlsx`);
  await workbook.xlsx.write(res);
  res.end();
};

exports.exportPdf = async (req, res) => {
  const report = await GardenCityPatrolReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=garden-city-report-${report.reportDate}.pdf`);

  const doc = buildGardenCityReportPdf(report);
  doc.pipe(res);
  doc.end();
};
