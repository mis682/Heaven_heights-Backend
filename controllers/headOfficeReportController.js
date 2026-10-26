const ExcelJS = require("exceljs");
const HeadOfficeDailyReport = require("../models/HeadOfficeDailyReport");
const { RESERVE_REGAL_CLUB_STATUS_OPTIONS } = require("../constants/gcClubReportStatus");
const { HEAD_OFFICE_FORMS, getFormByNumber } = require("../constants/headOfficeForms");
const { buildHeadOfficeReportPdf } = require("../utils/headOfficeReportPdf");
const { computeChecklistKpi } = require("../utils/checklistKpi");
const { buildChecklistKpiPdf } = require("../utils/checklistKpiPdf");

// Most checkpoints use the shared status vocabulary, but a "select" one
// (e.g. Handwash: Yes/No) needs its own options on the Daily Report too —
// so each checkpoint carries its own options here instead of just a label.
exports.meta = async (req, res) => {
  res.json({
    statusOptions: RESERVE_REGAL_CLUB_STATUS_OPTIONS,
    forms: HEAD_OFFICE_FORMS.map((f) => ({
      formNumber: f.formNumber,
      label: f.label,
      checkpoints: f.checkpoints.map((c) => ({
        label: c.label,
        options: c.type === "select" ? c.options : null,
      })),
    })),
  });
};

exports.getByDate = async (req, res) => {
  const { formNumber, date } = req.query;
  if (!formNumber || !date) return res.status(400).json({ message: "formNumber and date are required" });
  const report = await HeadOfficeDailyReport.findOne({ formNumber: Number(formNumber), reportDate: date });
  if (!report) return res.json(null);
  res.json(report);
};

exports.saveDraft = async (req, res) => {
  const { formNumber, reportDate, entries, preparedBy } = req.body;
  if (!formNumber || !reportDate) return res.status(400).json({ message: "formNumber and reportDate are required" });

  const report = await HeadOfficeDailyReport.findOneAndUpdate(
    { formNumber: Number(formNumber), reportDate, status: "draft" },
    { formNumber: Number(formNumber), reportDate, entries, preparedBy },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  res.json(report);
};

exports.submitReport = async (req, res) => {
  const report = await HeadOfficeDailyReport.findById(req.params.id);
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
  const report = await HeadOfficeDailyReport.findByIdAndUpdate(
    req.params.id,
    { status: "draft", submittedAt: null },
    { new: true }
  );
  if (!report) return res.status(404).json({ message: "Report not found" });
  res.json(report);
};

exports.getReport = async (req, res) => {
  const report = await HeadOfficeDailyReport.findById(req.params.id);
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
  const reports = await HeadOfficeDailyReport.find(filter).sort({ reportDate: -1 });
  const summarized = reports.map((r) => {
    const counts = {};
    RESERVE_REGAL_CLUB_STATUS_OPTIONS.forEach((s) => {
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
  const report = await HeadOfficeDailyReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });
  const form = getFormByNumber(report.formNumber);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`HeadOffice_${report.formNumber}_${report.reportDate}`);
  sheet.columns = [
    { header: "Checkpoint", key: "checkpoint", width: 30 },
    { header: report.reportDate, key: "status", width: 20 },
  ];
  report.entries.forEach((e) => {
    sheet.addRow({ checkpoint: e.checkpointLabel, status: e.status });
  });
  sheet.getRow(1).font = { bold: true };

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=head-office-${form?.label || report.formNumber}-${report.reportDate}.xlsx`
  );
  await workbook.xlsx.write(res);
  res.end();
};

exports.exportPdf = async (req, res) => {
  const report = await HeadOfficeDailyReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });
  const form = getFormByNumber(report.formNumber);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=head-office-${form?.label || report.formNumber}-${report.reportDate}.pdf`
  );

  const doc = buildHeadOfficeReportPdf(report, form);
  doc.pipe(res);
  doc.end();
};

// Compliance KPI, grouped by checkpoint, over a date range (optionally
// scoped to one form) — see utils/checklistKpi.js for what counts as "OK"
// vs "Not OK".
exports.kpi = async (req, res) => {
  const { from, to, formNumber } = req.query;
  if (!from || !to) return res.status(400).json({ message: "from and to are required" });
  const rows = await computeChecklistKpi(HeadOfficeDailyReport, {
    from,
    to,
    extraFilter: formNumber ? { formNumber: Number(formNumber) } : {},
    goodStatus: RESERVE_REGAL_CLUB_STATUS_OPTIONS[0],
    groupKey: (e) => e.checkpointLabel,
    groupLabel: (e) => e.checkpointLabel,
  });
  res.json({ rows });
};

exports.kpiExportPdf = async (req, res) => {
  const { from, to, formNumber } = req.query;
  if (!from || !to) return res.status(400).json({ message: "from and to are required" });
  const rows = await computeChecklistKpi(HeadOfficeDailyReport, {
    from,
    to,
    extraFilter: formNumber ? { formNumber: Number(formNumber) } : {},
    goodStatus: RESERVE_REGAL_CLUB_STATUS_OPTIONS[0],
    groupKey: (e) => e.checkpointLabel,
    groupLabel: (e) => e.checkpointLabel,
  });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=head-office-kpi-${from}-to-${to}.pdf`);
  const doc = buildChecklistKpiPdf("Head Office — KPI", from, to, rows);
  doc.pipe(res);
  doc.end();
};
