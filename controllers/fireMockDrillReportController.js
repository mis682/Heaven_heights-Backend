const ExcelJS = require("exceljs");
const FireMockDrill = require("../models/FireMockDrill");
const FireMockDrillDailyReport = require("../models/FireMockDrillDailyReport");
const { FIRE_MOCK_DRILL_STATUS_OPTIONS } = require("../constants/fireMockDrillReportStatus");
const { PROJECTS } = require("../controllers/fireMockDrillController");
const { buildFireMockDrillDailyReportPdf } = require("../utils/fireMockDrillDailyReportPdf");
const { buildCardReportPdf } = require("../utils/cardReportPdf");
const { computeChecklistKpi } = require("../utils/checklistKpi");
const { buildChecklistKpiPdf } = require("../utils/checklistKpiPdf");

exports.meta = async (req, res) => {
  res.json({ statusOptions: FIRE_MOCK_DRILL_STATUS_OPTIONS, projects: PROJECTS });
};

// Builds the attachment list a fresh Daily Report starts from — one entry
// per Panel Photo / Video / Checklist Page the matching submission actually
// has (skips empty slots). Picks the most recently submitted record for
// this project+date if more than one exists (e.g. a resubmission).
exports.submissionFor = async (req, res) => {
  const { projectName, date } = req.query;
  if (!projectName || !date) return res.status(400).json({ message: "projectName and date are required" });

  const submission = await FireMockDrill.findOne({ projectName, date }).sort({ createdAt: -1 });
  if (!submission) return res.json(null);

  const attachments = [];
  if (submission.panelPhoto) attachments.push({ label: "Panel Photo", url: submission.panelPhoto });
  (submission.videos || []).forEach((url, idx) => {
    if (url) attachments.push({ label: `Video ${idx + 1}`, url });
  });
  (submission.checklistAttachments || []).forEach((url, idx) => {
    if (url) attachments.push({ label: `Checklist Page ${idx + 1}`, url });
  });

  res.json({
    submissionId: submission._id,
    projectName: submission.projectName,
    date: submission.date,
    maintenanceSupervisor: submission.maintenanceSupervisor,
    issueIdentified: submission.issueIdentified,
    issueDescription: submission.issueDescription,
    actionTaken: submission.actionTaken,
    attachments,
  });
};

exports.getByDate = async (req, res) => {
  const { projectName, date } = req.query;
  if (!projectName || !date) return res.status(400).json({ message: "projectName and date are required" });
  const report = await FireMockDrillDailyReport.findOne({ projectName, reportDate: date });
  if (!report) return res.json(null);
  res.json(report);
};

exports.saveDraft = async (req, res) => {
  const {
    projectName,
    reportDate,
    submissionId,
    maintenanceSupervisor,
    issueIdentified,
    issueDescription,
    actionTaken,
    entries,
    preparedBy,
  } = req.body;
  if (!projectName || !reportDate) return res.status(400).json({ message: "projectName and reportDate are required" });

  const report = await FireMockDrillDailyReport.findOneAndUpdate(
    { projectName, reportDate, status: "draft" },
    {
      projectName,
      reportDate,
      submissionId: submissionId || null,
      maintenanceSupervisor: maintenanceSupervisor || "",
      issueIdentified: issueIdentified || "",
      issueDescription: issueDescription || "",
      actionTaken: actionTaken || "",
      entries,
      preparedBy,
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  res.json(report);
};

exports.submitReport = async (req, res) => {
  const report = await FireMockDrillDailyReport.findById(req.params.id);
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
  const report = await FireMockDrillDailyReport.findByIdAndUpdate(
    req.params.id,
    { status: "draft", submittedAt: null },
    { new: true }
  );
  if (!report) return res.status(404).json({ message: "Report not found" });
  res.json(report);
};

exports.getReport = async (req, res) => {
  const report = await FireMockDrillDailyReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });
  res.json(report);
};

exports.listSubmitted = async (req, res) => {
  const { projectName, from, to } = req.query;
  const filter = { status: "submitted" };
  if (projectName) filter.projectName = projectName;
  if (from || to) {
    filter.reportDate = {};
    if (from) filter.reportDate.$gte = from;
    if (to) filter.reportDate.$lte = to;
  }
  const reports = await FireMockDrillDailyReport.find(filter).sort({ reportDate: -1 });
  const summarized = reports.map((r) => {
    const counts = {};
    FIRE_MOCK_DRILL_STATUS_OPTIONS.forEach((s) => {
      counts[s] = r.entries.filter((e) => e.status === s).length;
    });
    return {
      _id: r._id,
      projectName: r.projectName,
      reportDate: r.reportDate,
      maintenanceSupervisor: r.maintenanceSupervisor,
      issueIdentified: r.issueIdentified,
      preparedBy: r.preparedBy,
      counts,
      submittedAt: r.submittedAt,
    };
  });
  res.json(summarized);
};

exports.exportExcel = async (req, res) => {
  const report = await FireMockDrillDailyReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`FireMockDrill_${report.projectName}_${report.reportDate}`);
  sheet.columns = [
    { header: "Attachment", key: "attachment", width: 30 },
    { header: report.reportDate, key: "status", width: 20 },
  ];
  report.entries.forEach((e) => {
    sheet.addRow({ attachment: e.attachmentLabel, status: e.status });
  });
  sheet.getRow(1).font = { bold: true };

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=fire-mock-drill-${report.projectName}-${report.reportDate}.xlsx`
  );
  await workbook.xlsx.write(res);
  res.end();
};

exports.exportPdf = async (req, res) => {
  const report = await FireMockDrillDailyReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=fire-mock-drill-${report.projectName}-${report.reportDate}.pdf`
  );

  const doc = req.query.layout === "card"
    ? buildCardReportPdf({
        title: `Fire Mock Drill — ${report.projectName} — ${report.reportDate}`,
        entries: report.entries.map((e) => ({ checkpointLabel: e.attachmentLabel, status: e.status })),
        goodStatus: FIRE_MOCK_DRILL_STATUS_OPTIONS[0],
      })
    : buildFireMockDrillDailyReportPdf(report);
  doc.pipe(res);
  doc.end();
};

// Compliance KPI, grouped by attachment label, over a date range (optionally
// scoped to one project) — see utils/checklistKpi.js for what counts as
// "OK" vs "Not OK".
exports.kpi = async (req, res) => {
  const { from, to, projectName } = req.query;
  if (!from || !to) return res.status(400).json({ message: "from and to are required" });
  const rows = await computeChecklistKpi(FireMockDrillDailyReport, {
    from,
    to,
    extraFilter: projectName ? { projectName } : {},
    goodStatus: FIRE_MOCK_DRILL_STATUS_OPTIONS[0],
    groupKey: (e) => e.attachmentLabel,
    groupLabel: (e) => e.attachmentLabel,
  });
  res.json({ rows });
};

exports.kpiExportPdf = async (req, res) => {
  const { from, to, projectName } = req.query;
  if (!from || !to) return res.status(400).json({ message: "from and to are required" });
  const rows = await computeChecklistKpi(FireMockDrillDailyReport, {
    from,
    to,
    extraFilter: projectName ? { projectName } : {},
    goodStatus: FIRE_MOCK_DRILL_STATUS_OPTIONS[0],
    groupKey: (e) => e.attachmentLabel,
    groupLabel: (e) => e.attachmentLabel,
  });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=fire-mock-drill-kpi-${from}-to-${to}.pdf`);
  const doc = buildChecklistKpiPdf("Fire Mock Drill — KPI", from, to, rows);
  doc.pipe(res);
  doc.end();
};
