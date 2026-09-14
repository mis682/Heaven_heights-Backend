const ExcelJS = require("exceljs");
const NightGuardSubmission = require("../models/NightGuardSubmission");
const NightGuardDailyReport = require("../models/NightGuardDailyReport");
const { fileToUrl } = require("../middleware/upload");
const { notifyWebhook } = require("../utils/webhook");
const { buildNightGuardReportPdf } = require("../utils/nightGuardReportPdf");
const { buildIstDateRangeFilter } = require("../utils/istDateRange");
const { computeNightGuardKpi } = require("../utils/nightGuardKpi");

exports.meta = async (req, res) => {
  res.json({
    statusOptions: NightGuardDailyReport.STATUS_OPTIONS,
    timeSlots: NightGuardDailyReport.TIME_SLOTS,
    sites: ["One Business Center", "Hyde Park", "Milestone", "GST", "Garden City", "Regal Garden", "Nature Park"],
  });
};

// --- Guard proof-of-presence submissions ---

exports.createSubmission = async (req, res) => {
  const { guardName, projectName, capturedAt, geoLocation } = req.body;
  if (!guardName || !projectName || !req.file) {
    return res.status(400).json({ message: "guardName, projectName and guardPhoto are required" });
  }

  let geo = {};
  try {
    geo = geoLocation ? JSON.parse(geoLocation) : {};
  } catch {
    geo = {};
  }

  const submission = await NightGuardSubmission.create({
    guardName,
    projectName,
    guardPhotoUrl: fileToUrl(req.file),
    capturedAt: capturedAt ? new Date(capturedAt) : new Date(),
    geoLocation: geo,
  });

  notifyWebhook({
    type: "night_guard",
    guardName,
    projectName,
    guardPhotoUrl: submission.guardPhotoUrl,
    capturedAt: submission.capturedAt,
    message: `🌙 *${guardName}* checked in for Night Guard at *${projectName}*\n\n${submission.guardPhotoUrl}`,
  });

  res.status(201).json(submission);
};

exports.listSubmissions = async (req, res) => {
  const { site, date, dateFrom, dateTo, hour } = req.query;
  const filter = {};
  if (site) filter.projectName = site;
  const dateFilter = buildIstDateRangeFilter(dateFrom || date, dateTo || date);
  if (dateFilter) filter.capturedAt = dateFilter;
  let submissions = await NightGuardSubmission.find(filter).sort({ capturedAt: -1 });
  if (hour) {
    submissions = submissions.filter((s) => formatHour(s.capturedAt) === hour);
  }
  res.json(submissions);
};

function formatHour(date) {
  const d = new Date(date);
  let h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:00 ${ampm}`;
}

// Guard KPI — there's no fixed schedule or checkpoint list here, just a
// guard expected to check in roughly hourly for as long as their shift
// runs; see computeNightGuardKpi for how that cadence is judged directly
// from actual submission timestamps.
exports.getGuardKpi = async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ message: "from and to are required" });
  const rows = await computeNightGuardKpi({ from, to });
  res.json({ rows });
};

// --- Coordinator daily report builder ---

// A report is an open-ended log, not scoped to one day — at most one draft
// is ever open. Entries within it each carry their own date.
exports.getOpenDraft = async (req, res) => {
  const report = await NightGuardDailyReport.findOne({ status: "draft" });
  res.json(report || null);
};

exports.saveDraft = async (req, res) => {
  const { entries, preparedBy } = req.body;

  const report = await NightGuardDailyReport.findOneAndUpdate(
    { status: "draft" },
    { entries: entries || [], preparedBy: preparedBy || "" },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.json(report);
};

exports.submitReport = async (req, res) => {
  const report = await NightGuardDailyReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });
  if (report.status === "submitted") {
    return res.status(400).json({ message: "Report already submitted" });
  }
  if (report.entries.length === 0) {
    return res.status(400).json({ message: "Cannot submit a report with no entries" });
  }
  report.status = "submitted";
  report.submittedAt = new Date();
  await report.save();
  res.json(report);
};

exports.unlockReport = async (req, res) => {
  const report = await NightGuardDailyReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });
  report.status = "draft";
  report.submittedAt = null;
  await report.save();
  res.json(report);
};

exports.getReport = async (req, res) => {
  const report = await NightGuardDailyReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });
  res.json(report);
};

// --- Admin dashboard ---

// Entries can span several dates now, so reports are filtered/sorted by
// submittedAt (always present) rather than a single report-level date.
function dateRangeLabel(report) {
  const dates = report.entries.map((e) => e.date).filter(Boolean).sort();
  if (dates.length === 0) return report.reportDate || "";
  const min = dates[0];
  const max = dates[dates.length - 1];
  return min === max ? min : `${min} to ${max}`;
}

exports.listSubmittedReports = async (req, res) => {
  const { dateFrom, dateTo, site } = req.query;
  const filter = { status: "submitted" };
  if (dateFrom || dateTo) {
    filter.submittedAt = {};
    if (dateFrom) filter.submittedAt.$gte = new Date(`${dateFrom}T00:00:00`);
    if (dateTo) filter.submittedAt.$lte = new Date(`${dateTo}T23:59:59.999`);
  }
  if (site) filter["entries.site"] = site;

  const reports = await NightGuardDailyReport.find(filter).sort({ submittedAt: -1 });

  const summarized = reports.map((r) => {
    const sites = [...new Set(r.entries.map((e) => e.site))];
    const present = r.entries.filter((e) => e.status === "Present").length;
    const absent = r.entries.filter((e) => e.status === "Absent").length;
    return {
      _id: r._id,
      dateRange: dateRangeLabel(r),
      preparedBy: r.preparedBy,
      sites,
      present,
      absent,
      submittedAt: r.submittedAt,
    };
  });

  res.json(summarized);
};

exports.exportReport = async (req, res) => {
  const report = await NightGuardDailyReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });

  const filenameDate = dateRangeLabel(report).replace(/\s+/g, "");

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`NightGuard_${filenameDate}`.slice(0, 31));
  sheet.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Site", key: "site", width: 22 },
    { header: "Time", key: "timeSlot", width: 12 },
    { header: "Status", key: "status", width: 18 },
    { header: "Guard Name", key: "guardName", width: 24 },
  ];
  report.entries.forEach((e) => {
    sheet.addRow({ date: e.date || report.reportDate, site: e.site, timeSlot: e.timeSlot, status: e.status, guardName: e.guardName });
  });

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.getCell(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFBFBFBF" } };
  headerRow.getCell(5).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=night-guard-report-${filenameDate}.xlsx`);
  await workbook.xlsx.write(res);
  res.end();
};

exports.exportPdf = async (req, res) => {
  const report = await NightGuardDailyReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });

  const rangeLabel = dateRangeLabel(report);
  const filenameDate = rangeLabel.replace(/\s+/g, "");

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=night-guard-report-${filenameDate}.pdf`);

  const doc = buildNightGuardReportPdf(report, rangeLabel);
  doc.pipe(res);
  doc.end();
};
