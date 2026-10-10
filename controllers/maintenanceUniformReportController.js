const ExcelJS = require("exceljs");
const MaintenanceUniformDailyReport = require("../models/MaintenanceUniformDailyReport");
const MaintenanceStaff = require("../models/MaintenanceStaff");
const { MAINTENANCE_UNIFORM_STATUS_OPTIONS, MAINTENANCE_UNIFORM_DESIGNATIONS } = require("../constants/maintenanceUniformStatus");
const { buildMaintenanceUniformReportPdf } = require("../utils/maintenanceUniformReportPdf");

// Builds the designation-grouped staff list fresh from MaintenanceStaff every
// time (not cached) — a new hire or a since-removed staff member should show
// up/disappear immediately, same as the rest of the app's staff-driven pages.
async function getGroupedStaffList() {
  const staff = await MaintenanceStaff.find({ designation: { $in: MAINTENANCE_UNIFORM_DESIGNATIONS } })
    .sort({ name: 1 })
    .lean();
  const order = new Map(MAINTENANCE_UNIFORM_DESIGNATIONS.map((d, i) => [d, i]));
  staff.sort((a, b) => order.get(a.designation) - order.get(b.designation));
  return staff.map((s) => ({ staffId: s._id, staffName: s.name, designation: s.designation, siteName: s.siteName }));
}

exports.meta = async (req, res) => {
  const staffList = await getGroupedStaffList();
  res.json({ statusOptions: MAINTENANCE_UNIFORM_STATUS_OPTIONS, staffList });
};

// Backs the standalone "Staff List" page — same 3 designations, same
// grouping, just exposed as its own endpoint since that page isn't nested
// under the daily-report flow.
exports.staffList = async (req, res) => {
  const staffList = await getGroupedStaffList();
  res.json(staffList);
};

exports.getByDate = async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ message: "date is required" });
  const report = await MaintenanceUniformDailyReport.findOne({ reportDate: date });
  if (!report) return res.json(null);
  res.json(report);
};

exports.saveDraft = async (req, res) => {
  const { reportDate, entries, preparedBy } = req.body;
  if (!reportDate) return res.status(400).json({ message: "reportDate is required" });

  const report = await MaintenanceUniformDailyReport.findOneAndUpdate(
    { reportDate, status: "draft" },
    { reportDate, entries, preparedBy },
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
  const { from, to } = req.query;
  const filter = { status: "submitted" };
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
  res.setHeader("Content-Disposition", `attachment; filename=maintenance-uniform-${report.reportDate}.xlsx`);
  await workbook.xlsx.write(res);
  res.end();
};

exports.exportPdf = async (req, res) => {
  const report = await MaintenanceUniformDailyReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=maintenance-uniform-${report.reportDate}.pdf`);

  const doc = buildMaintenanceUniformReportPdf(report);
  doc.pipe(res);
  doc.end();
};
