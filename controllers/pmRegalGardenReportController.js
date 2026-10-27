const ExcelJS = require("exceljs");
const PmRegalGardenDailyReport = require("../models/PmRegalGardenDailyReport");
const { PM_STATUS_OPTIONS } = require("../constants/pmReportStatus");
const { PM_REGAL_GARDEN_FORMS, getFormByNumber } = require("../constants/pmRegalGardenForms");
const { buildPmRegalGardenReportPdf } = require("../utils/pmRegalGardenReportPdf");
const { buildCardReportPdf } = require("../utils/cardReportPdf");
const { computeChecklistKpi } = require("../utils/checklistKpi");
const { escapeRegex } = require("../utils/escapeRegex");
const { buildChecklistKpiPdf } = require("../utils/checklistKpiPdf");

// "Unit No." (and any other text-type field) is excluded here — those are
// captured on the public submission form, but on the Daily Report they're a
// report-identifying field (see unitNo below), not a per-date checkpoint row.
exports.meta = async (req, res) => {
  res.json({
    statusOptions: PM_STATUS_OPTIONS,
    forms: PM_REGAL_GARDEN_FORMS.map((f) => ({
      formNumber: f.formNumber,
      label: f.label,
      checkpoints: f.checkpoints.filter((c) => c.type !== "text").map((c) => ({ label: c.label, type: c.type || "photo" })),
    })),
  });
};

// One report per (form, date, unit) — the same form/date can have many
// reports, one per unit being photographed (Unit 18 and Unit 19 both get
// their own report for the same date).
exports.getByDate = async (req, res) => {
  const { formNumber, date, unitNo } = req.query;
  if (!formNumber || !date || !unitNo) return res.status(400).json({ message: "formNumber, date and unitNo are required" });
  const report = await PmRegalGardenDailyReport.findOne({ formNumber: Number(formNumber), reportDate: date, unitNo });
  if (!report) return res.json(null);
  res.json(report);
};

exports.saveDraft = async (req, res) => {
  const { formNumber, reportDate, unitNo, entries, preparedBy } = req.body;
  if (!formNumber || !reportDate || !unitNo) {
    return res.status(400).json({ message: "formNumber, reportDate and unitNo are required" });
  }

  const report = await PmRegalGardenDailyReport.findOneAndUpdate(
    { formNumber: Number(formNumber), reportDate, unitNo, status: "draft" },
    { formNumber: Number(formNumber), reportDate, unitNo, entries, preparedBy },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  res.json(report);
};

exports.submitReport = async (req, res) => {
  const report = await PmRegalGardenDailyReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });
  if (report.status === "submitted") return res.status(400).json({ message: "Report already submitted" });
  const hasAnyEntry = (report.entries || []).some((e) => e.status || e.value);
  if (!hasAnyEntry) return res.status(400).json({ message: "Fill at least one row before submitting" });

  report.status = "submitted";
  report.submittedAt = new Date();
  await report.save();
  res.json(report);
};

exports.unlockReport = async (req, res) => {
  const report = await PmRegalGardenDailyReport.findByIdAndUpdate(
    req.params.id,
    { status: "draft", submittedAt: null },
    { new: true }
  );
  if (!report) return res.status(404).json({ message: "Report not found" });
  res.json(report);
};

exports.getReport = async (req, res) => {
  const report = await PmRegalGardenDailyReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });
  res.json(report);
};

exports.listSubmitted = async (req, res) => {
  const { formNumber, from, to, unitNo } = req.query;
  const filter = { status: "submitted" };
  if (formNumber) filter.formNumber = Number(formNumber);
  if (unitNo) filter.unitNo = { $regex: escapeRegex(unitNo), $options: "i" };
  if (from || to) {
    filter.reportDate = {};
    if (from) filter.reportDate.$gte = from;
    if (to) filter.reportDate.$lte = to;
  }
  const reports = await PmRegalGardenDailyReport.find(filter).sort({ reportDate: -1 });
  const summarized = reports.map((r) => {
    const counts = {};
    PM_STATUS_OPTIONS.forEach((s) => {
      counts[s] = r.entries.filter((e) => e.status === s).length;
    });
    return {
      _id: r._id,
      formNumber: r.formNumber,
      formLabel: getFormByNumber(r.formNumber)?.label || `Form ${r.formNumber}`,
      reportDate: r.reportDate,
      unitNo: r.unitNo,
      preparedBy: r.preparedBy,
      counts,
      submittedAt: r.submittedAt,
    };
  });
  res.json(summarized);
};

exports.exportExcel = async (req, res) => {
  const report = await PmRegalGardenDailyReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });
  const form = getFormByNumber(report.formNumber);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`PmRegalGarden_${report.formNumber}_${report.reportDate}`);
  sheet.columns = [
    { header: "Checkpoint", key: "checkpoint", width: 30 },
    { header: report.reportDate, key: "status", width: 20 },
  ];
  report.entries.forEach((e) => {
    sheet.addRow({ checkpoint: e.checkpointLabel, status: e.value || e.status });
  });
  sheet.getRow(1).font = { bold: true };

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=pm-regal-garden-${form?.label || report.formNumber}-unit-${report.unitNo}-${report.reportDate}.xlsx`
  );
  await workbook.xlsx.write(res);
  res.end();
};

exports.exportPdf = async (req, res) => {
  const report = await PmRegalGardenDailyReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });
  const form = getFormByNumber(report.formNumber);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=pm-regal-garden-${form?.label || report.formNumber}-unit-${report.unitNo}-${report.reportDate}.pdf`
  );

  const doc = req.query.layout === "card"
    ? buildCardReportPdf({
        title: `Property Management — Regal Garden — ${form?.label || `Form ${report.formNumber}`} — Unit ${report.unitNo} — ${report.reportDate}`,
        entries: report.entries,
        goodStatus: PM_STATUS_OPTIONS[0],
      })
    : buildPmRegalGardenReportPdf(report, form);
  doc.pipe(res);
  doc.end();
};

// Compliance KPI, grouped by checkpoint, over a date range (optionally
// scoped to one form) — see utils/checklistKpi.js for what counts as "OK"
// vs "Not OK".
exports.kpi = async (req, res) => {
  const { from, to, formNumber } = req.query;
  if (!from || !to) return res.status(400).json({ message: "from and to are required" });
  const rows = await computeChecklistKpi(PmRegalGardenDailyReport, {
    from,
    to,
    extraFilter: formNumber ? { formNumber: Number(formNumber) } : {},
    goodStatus: PM_STATUS_OPTIONS[0],
    groupKey: (e) => e.checkpointLabel,
    groupLabel: (e) => e.checkpointLabel,
  });
  res.json({ rows });
};

exports.kpiExportPdf = async (req, res) => {
  const { from, to, formNumber } = req.query;
  if (!from || !to) return res.status(400).json({ message: "from and to are required" });
  const rows = await computeChecklistKpi(PmRegalGardenDailyReport, {
    from,
    to,
    extraFilter: formNumber ? { formNumber: Number(formNumber) } : {},
    goodStatus: PM_STATUS_OPTIONS[0],
    groupKey: (e) => e.checkpointLabel,
    groupLabel: (e) => e.checkpointLabel,
  });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=pm-regal-garden-kpi-${from}-to-${to}.pdf`);
  const doc = buildChecklistKpiPdf("Property Management — Regal Garden — KPI", from, to, rows);
  doc.pipe(res);
  doc.end();
};
