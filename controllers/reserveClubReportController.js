const ExcelJS = require("exceljs");
const ReserveClubDailyReport = require("../models/ReserveClubDailyReport");
const { GC_CLUB_STATUS_OPTIONS } = require("../constants/gcClubReportStatus");
const { RESERVE_CLUB_FORMS, getFormByNumber } = require("../constants/reserveClubForms");
const { buildReserveClubReportPdf } = require("../utils/reserveClubReportPdf");

exports.meta = async (req, res) => {
  res.json({
    statusOptions: GC_CLUB_STATUS_OPTIONS,
    forms: RESERVE_CLUB_FORMS.map((f) => ({
      formNumber: f.formNumber,
      label: f.label,
      checkpoints: f.checkpoints.map((c) => c.label),
    })),
  });
};

exports.getByDate = async (req, res) => {
  const { formNumber, date } = req.query;
  if (!formNumber || !date) return res.status(400).json({ message: "formNumber and date are required" });
  const report = await ReserveClubDailyReport.findOne({ formNumber: Number(formNumber), reportDate: date });
  if (!report) return res.json(null);
  res.json(report);
};

exports.saveDraft = async (req, res) => {
  const { formNumber, reportDate, entries, preparedBy } = req.body;
  if (!formNumber || !reportDate) return res.status(400).json({ message: "formNumber and reportDate are required" });

  const report = await ReserveClubDailyReport.findOneAndUpdate(
    { formNumber: Number(formNumber), reportDate, status: "draft" },
    { formNumber: Number(formNumber), reportDate, entries, preparedBy },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  res.json(report);
};

exports.submitReport = async (req, res) => {
  const report = await ReserveClubDailyReport.findById(req.params.id);
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
  const report = await ReserveClubDailyReport.findByIdAndUpdate(
    req.params.id,
    { status: "draft", submittedAt: null },
    { new: true }
  );
  if (!report) return res.status(404).json({ message: "Report not found" });
  res.json(report);
};

exports.getReport = async (req, res) => {
  const report = await ReserveClubDailyReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });
  res.json(report);
};

exports.listSubmitted = async (req, res) => {
  const { formNumber, from, to } = req.query;
  const filter = { status: "submitted" };
  if (formNumber) filter.formNumber = Number(formNumber);
  if (from || to) {
    filter.reportDate = {};
    if (from) filter.reportDate.$gte = from;
    if (to) filter.reportDate.$lte = to;
  }
  const reports = await ReserveClubDailyReport.find(filter).sort({ reportDate: -1 });
  const summarized = reports.map((r) => {
    const counts = {};
    GC_CLUB_STATUS_OPTIONS.forEach((s) => {
      counts[s] = r.entries.filter((e) => e.status === s).length;
    });
    return {
      _id: r._id,
      formNumber: r.formNumber,
      formLabel: getFormByNumber(r.formNumber)?.label || `Form ${r.formNumber}`,
      reportDate: r.reportDate,
      preparedBy: r.preparedBy,
      counts,
      submittedAt: r.submittedAt,
    };
  });
  res.json(summarized);
};

exports.exportExcel = async (req, res) => {
  const report = await ReserveClubDailyReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });
  const form = getFormByNumber(report.formNumber);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`ReserveClub_${report.formNumber}_${report.reportDate}`);
  sheet.columns = [
    { header: "Checkpoint", key: "checkpoint", width: 30 },
    { header: report.reportDate, key: "status", width: 20 },
  ];
  report.entries.forEach((e) => {
    sheet.addRow({ checkpoint: e.checkpointLabel, status: e.status });
  });
  sheet.getRow(1).font = { bold: true };

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=reserve-club-${form?.label || report.formNumber}-${report.reportDate}.xlsx`);
  await workbook.xlsx.write(res);
  res.end();
};

exports.exportPdf = async (req, res) => {
  const report = await ReserveClubDailyReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });
  const form = getFormByNumber(report.formNumber);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=reserve-club-${form?.label || report.formNumber}-${report.reportDate}.pdf`);

  const doc = buildReserveClubReportPdf(report, form);
  doc.pipe(res);
  doc.end();
};
