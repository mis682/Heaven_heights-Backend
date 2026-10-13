const ExcelJS = require("exceljs");
const MaintenanceUniformDailyReport = require("../models/MaintenanceUniformDailyReport");
const MaintenanceStaff = require("../models/MaintenanceStaff");
const {
  MAINTENANCE_UNIFORM_STATUS_OPTIONS,
  MAINTENANCE_UNIFORM_DESIGNATIONS,
  MAINTENANCE_UNIFORM_REPORT_FORMATS,
} = require("../constants/maintenanceUniformStatus");
const { buildMaintenanceUniformReportPdf } = require("../utils/maintenanceUniformReportPdf");
const { computeChecklistKpi } = require("../utils/checklistKpi");
const { buildChecklistKpiPdf } = require("../utils/checklistKpiPdf");

// Builds the designation-grouped staff list fresh from MaintenanceStaff every
// time (not cached) — a new hire or a since-removed staff member should show
// up/disappear immediately, same as the rest of the app's staff-driven pages.
// `siteNames`, when given, restricts this to one coordinator's report (see
// MAINTENANCE_UNIFORM_REPORT_FORMATS) — omitted entirely for the standalone
// Staff List page, which shows every site at once.
async function getGroupedStaffList(siteNames) {
  const filter = { designation: { $in: MAINTENANCE_UNIFORM_DESIGNATIONS } };
  if (siteNames) filter.siteName = { $in: siteNames };
  const staff = await MaintenanceStaff.find(filter).sort({ name: 1 }).lean();
  const order = new Map(MAINTENANCE_UNIFORM_DESIGNATIONS.map((d, i) => [d, i]));
  staff.sort((a, b) => order.get(a.designation) - order.get(b.designation));
  return staff.map((s) => ({ staffId: s._id, staffName: s.name, designation: s.designation, siteName: s.siteName }));
}

exports.meta = async (req, res) => {
  res.json({ statusOptions: MAINTENANCE_UNIFORM_STATUS_OPTIONS, reportFormats: MAINTENANCE_UNIFORM_REPORT_FORMATS });
};

// Backs the standalone "Staff List" page (no ?reportName — every site) and
// the Daily Report page's per-coordinator staff list (?reportName=... scopes
// it to that report's sites).
exports.staffList = async (req, res) => {
  const { reportName } = req.query;
  const siteNames = reportName ? MAINTENANCE_UNIFORM_REPORT_FORMATS[reportName] : null;
  if (reportName && !siteNames) return res.status(400).json({ message: "Unknown reportName" });
  const staffList = await getGroupedStaffList(siteNames);
  res.json(staffList);
};

exports.getByDate = async (req, res) => {
  const { date, reportName } = req.query;
  if (!date || !reportName) return res.status(400).json({ message: "date and reportName are required" });
  const report = await MaintenanceUniformDailyReport.findOne({ reportDate: date, reportName });
  if (!report) return res.json(null);
  res.json(report);
};

exports.saveDraft = async (req, res) => {
  const { reportDate, reportName, entries, preparedBy } = req.body;
  if (!reportDate || !reportName) return res.status(400).json({ message: "reportDate and reportName are required" });

  const report = await MaintenanceUniformDailyReport.findOneAndUpdate(
    { reportDate, reportName, status: "draft" },
    { reportDate, reportName, entries, preparedBy },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  res.json(report);
};

exports.submitReport = async (req, res) => {
  const report = await MaintenanceUniformDailyReport.findById(req.params.id);
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
  const report = await MaintenanceUniformDailyReport.findByIdAndUpdate(
    req.params.id,
    { status: "draft", submittedAt: null },
    { new: true }
  );
  if (!report) return res.status(404).json({ message: "Report not found" });
  res.json(report);
};

exports.getReport = async (req, res) => {
  const report = await MaintenanceUniformDailyReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });
  res.json(report);
};

exports.listSubmitted = async (req, res) => {
  const { from, to, reportName } = req.query;
  const filter = { status: "submitted" };
  if (reportName) filter.reportName = reportName;
  if (from || to) {
    filter.reportDate = {};
    if (from) filter.reportDate.$gte = from;
    if (to) filter.reportDate.$lte = to;
  }
  const reports = await MaintenanceUniformDailyReport.find(filter).sort({ reportDate: -1 });
  const summarized = reports.map((r) => {
    const counts = {};
    MAINTENANCE_UNIFORM_STATUS_OPTIONS.forEach((s) => {
      counts[s] = r.entries.filter((e) => e.status === s).length;
    });
    return {
      _id: r._id,
      reportDate: r.reportDate,
      reportName: r.reportName,
      preparedBy: r.preparedBy,
      counts,
      submittedAt: r.submittedAt,
    };
  });
  res.json(summarized);
};

exports.exportExcel = async (req, res) => {
  const report = await MaintenanceUniformDailyReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`MaintenanceUniform_${report.reportDate}`);
  sheet.columns = [
    { header: "Designation", key: "designation", width: 18 },
    { header: "Staff Name", key: "staffName", width: 24 },
    { header: "Site Name", key: "siteName", width: 20 },
    { header: report.reportDate, key: "status", width: 18 },
  ];
  report.entries.forEach((e) => {
    sheet.addRow({ designation: e.designation, staffName: e.staffName, siteName: e.siteName, status: e.status });
  });
  sheet.getRow(1).font = { bold: true };

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=maintenance-uniform-${report.reportName.replace(/\s+/g, "-")}-${report.reportDate}.xlsx`
  );
  await workbook.xlsx.write(res);
  res.end();
};

exports.exportPdf = async (req, res) => {
  const report = await MaintenanceUniformDailyReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=maintenance-uniform-${report.reportName.replace(/\s+/g, "-")}-${report.reportDate}.pdf`
  );

  const doc = buildMaintenanceUniformReportPdf(report);
  doc.pipe(res);
  doc.end();
};

// Compliance KPI, grouped by staff member, over a date range (optionally
// scoped to one coordinator's report) — see utils/checklistKpi.js for what
// counts as "OK" vs "Not OK".
exports.kpi = async (req, res) => {
  const { from, to, reportName } = req.query;
  if (!from || !to) return res.status(400).json({ message: "from and to are required" });
  const rows = await computeChecklistKpi(MaintenanceUniformDailyReport, {
    from,
    to,
    extraFilter: reportName ? { reportName } : {},
    goodStatus: MAINTENANCE_UNIFORM_STATUS_OPTIONS[0],
    groupKey: (e) => String(e.staffId || e.staffName),
    groupLabel: (e) => `${e.staffName} (${e.siteName})`,
  });
  res.json({ rows });
};

exports.kpiExportPdf = async (req, res) => {
  const { from, to, reportName } = req.query;
  if (!from || !to) return res.status(400).json({ message: "from and to are required" });
  const rows = await computeChecklistKpi(MaintenanceUniformDailyReport, {
    from,
    to,
    extraFilter: reportName ? { reportName } : {},
    goodStatus: MAINTENANCE_UNIFORM_STATUS_OPTIONS[0],
    groupKey: (e) => String(e.staffId || e.staffName),
    groupLabel: (e) => `${e.staffName} (${e.siteName})`,
  });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=maintenance-uniform-kpi-${from}-to-${to}.pdf`);
  const doc = buildChecklistKpiPdf("Maintenance Uniform — KPI", from, to, rows);
  doc.pipe(res);
  doc.end();
};
