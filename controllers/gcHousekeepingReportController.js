const ExcelJS = require("exceljs");
const GCHousekeepingDailyReport = require("../models/GCHousekeepingDailyReport");
const { GC_HOUSEKEEPING_STATUS_OPTIONS } = require("../constants/gcHousekeepingReportStatus");
const { buildGCHousekeepingReportPdf } = require("../utils/gcHousekeepingReportPdf");

// Garden City Housekeeping always covers checkpoints 1-150 (the same range
// split across GC Form 1-4) — every date's report gets all 150 rows
// pre-populated at once so the coordinator only has to set statuses, never
// add rows one at a time.
const TOTAL_CHECKPOINTS = 150;

exports.meta = async (req, res) => {
  const schedule = Array.from({ length: TOTAL_CHECKPOINTS }, (_, i) => ({ checkpointId: i + 1 }));
  res.json({ statusOptions: GC_HOUSEKEEPING_STATUS_OPTIONS, schedule });
};

exports.getByDate = async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ message: "date is required" });
  const report = await GCHousekeepingDailyReport.findOne({ reportDate: date });
  if (!report) return res.json(null);
  res.json(report);
};

exports.saveDraft = async (req, res) => {
  const { reportDate, entries, preparedBy } = req.body;
  if (!reportDate) return res.status(400).json({ message: "reportDate is required" });

  const report = await GCHousekeepingDailyReport.findOneAndUpdate(
    { reportDate, status: "draft" },
    { reportDate, entries, preparedBy },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  res.json(report);
};

exports.submitReport = async (req, res) => {
  const report = await GCHousekeepingDailyReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });
  if (report.status === "submitted") return res.status(400).json({ message: "Report already submitted" });
  const hasAnyEntry = (report.entries || []).some((e) => e.status);
  if (!hasAnyEntry) return res.status(400).json({ message: "Fill at least one row before submitting" });

  report.status = "submitted";
  report.submittedAt = new Date();
  await report.save();
  res.json(report);
};

exports.unlockReport = async (req, res) => {
  const report = await GCHousekeepingDailyReport.findByIdAndUpdate(
    req.params.id,
    { status: "draft", submittedAt: null },
    { new: true }
  );
  if (!report) return res.status(404).json({ message: "Report not found" });
  res.json(report);
};

exports.getReport = async (req, res) => {
  const report = await GCHousekeepingDailyReport.findById(req.params.id);
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
  const reports = await GCHousekeepingDailyReport.find(filter).sort({ reportDate: -1 });
  const summarized = reports.map((r) => {
    const counts = {};
    GC_HOUSEKEEPING_STATUS_OPTIONS.forEach((s) => {
      counts[s] = r.entries.filter((e) => e.status === s).length;
    });
    return {
      _id: r._id,
      reportDate: r.reportDate,
      preparedBy: r.preparedBy,
      counts,
      submittedAt: r.submittedAt,
    };
  });
  res.json(summarized);
};

exports.exportExcel = async (req, res) => {
  const report = await GCHousekeepingDailyReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`GCHousekeeping_${report.reportDate}`);
  sheet.columns = [
    { header: "Checkpoint", key: "checkpoint", width: 20 },
    { header: report.reportDate, key: "status", width: 20 },
  ];
  report.entries.forEach((e) => {
    sheet.addRow({ checkpoint: `Checkpoint-${e.checkpointId}`, status: e.status });
  });
  sheet.getRow(1).font = { bold: true };

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=gc-housekeeping-report-${report.reportDate}.xlsx`);
  await workbook.xlsx.write(res);
  res.end();
};

exports.exportPdf = async (req, res) => {
  const report = await GCHousekeepingDailyReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=gc-housekeeping-report-${report.reportDate}.pdf`);

  const doc = buildGCHousekeepingReportPdf(report);
  doc.pipe(res);
  doc.end();
};
