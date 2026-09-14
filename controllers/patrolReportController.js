const ExcelJS = require("exceljs");
const PatrolDailyReport = require("../models/PatrolDailyReport");
const PatrolSubmission = require("../models/PatrolSubmission");
const Project = require("../models/Project");
const Checkpoint = require("../models/Checkpoint");
const { buildCheckpointReportPdf } = require("../utils/checkpointReportPdf");
const { computeFixedHourGuardKpi } = require("../utils/patrolRoundSla");

// Every patrol site uses the default hourly grid except where noted here —
// Nature Park's actual patrol round runs on irregular, non-hourly time ranges.
const SITE_TIME_SLOTS = {
  "nature-park": [
    "9:00 PM TO 10:30 PM",
    "10:30 PM TO 11:55 PM",
    "12:30 AM TO 2:00 AM",
    "2:00 AM TO 3:30 AM",
    "3:30 AM TO 5:00 AM",
    "5:30 AM TO 7:00 AM",
  ],
};

exports.meta = async (req, res) => {
  const { projectSlug } = req.query;
  res.json({
    statusOptions: PatrolDailyReport.STATUS_OPTIONS,
    timeSlots: SITE_TIME_SLOTS[projectSlug] || PatrolDailyReport.TIME_SLOTS,
  });
};

// Checkpoint photos a guard captured during a given hour, to cross-check before marking status
exports.getCheckpointProof = async (req, res) => {
  const { projectId, guardName, date, slotIndex } = req.query;
  if (!projectId || !guardName || !date || slotIndex === undefined) {
    return res.status(400).json({ message: "projectId, guardName, date and slotIndex are required" });
  }

  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const submissions = await PatrolSubmission.find({ projectId, guardName, submittedAt: { $gte: start, $lt: end } });
  const hour = Number(slotIndex);
  const photos = submissions.flatMap((s) => s.photos).filter((p) => new Date(p.capturedAt).getHours() === hour);

  res.json(photos);
};

// A site's report is an open-ended log, not scoped to one day — at most one
// draft is ever open per project. Entries within it each carry their own date.
exports.getOpenDraft = async (req, res) => {
  const { projectId } = req.query;
  if (!projectId) return res.status(400).json({ message: "projectId is required" });
  const report = await PatrolDailyReport.findOne({ projectId, status: "draft" });
  res.json(report || null);
};

exports.saveDraft = async (req, res) => {
  const { projectId, projectName, entries } = req.body;
  if (!projectId || !projectName) {
    return res.status(400).json({ message: "projectId and projectName are required" });
  }

  const project = await Project.findById(projectId);
  if (!project) return res.status(404).json({ message: "Project not found" });

  const report = await PatrolDailyReport.findOneAndUpdate(
    { projectId, status: "draft" },
    {
      projectId,
      projectName,
      checkpointCount: project.checkpointCount,
      entries: entries || [],
      preparedBy: req.body.preparedBy || "",
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.json(report);
};

exports.submitReport = async (req, res) => {
  const report = await PatrolDailyReport.findById(req.params.id);
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
  const report = await PatrolDailyReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });
  report.status = "draft";
  report.submittedAt = null;
  await report.save();
  res.json(report);
};

exports.getReport = async (req, res) => {
  const report = await PatrolDailyReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });
  res.json(report);
};

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
  const { dateFrom, dateTo, projectId } = req.query;
  const filter = { status: "submitted" };
  if (projectId) filter.projectId = projectId;
  if (dateFrom || dateTo) {
    filter.submittedAt = {};
    if (dateFrom) filter.submittedAt.$gte = new Date(`${dateFrom}T00:00:00`);
    if (dateTo) filter.submittedAt.$lte = new Date(`${dateTo}T23:59:59.999`);
  }

  const reports = await PatrolDailyReport.find(filter).sort({ submittedAt: -1 });

  const summarized = reports.map((r) => {
    const guards = [...new Set(r.entries.map((e) => e.guardName))];
    const allStatuses = r.entries.flatMap((e) => e.checkpointStatuses);
    const present = allStatuses.filter((s) => s === "Present").length;
    const absent = allStatuses.filter((s) => s === "Absent").length;
    return {
      _id: r._id,
      dateRange: dateRangeLabel(r),
      projectName: r.projectName,
      preparedBy: r.preparedBy,
      guards,
      present,
      absent,
      submittedAt: r.submittedAt,
    };
  });

  res.json(summarized);
};

exports.exportReport = async (req, res) => {
  const report = await PatrolDailyReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });

  const filenameDate = dateRangeLabel(report).replace(/\s+/g, "");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`Patrol_${filenameDate}`.slice(0, 31));
  const checkpointRange = report.checkpointCount > 0 ? `C1 TO C${report.checkpointCount}` : "";
  const columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Guard Name", key: "guardName", width: 24 },
    { header: "Time", key: "timeSlot", width: 22 },
    { header: "Checkpoint", key: "checkpointRange", width: 14 },
  ];
  for (let i = 1; i <= report.checkpointCount; i += 1) {
    columns.push({ header: `Checkpoint-${i}`, key: `cp${i}`, width: 16 });
  }
  sheet.columns = columns;

  report.entries.forEach((e) => {
    const row = { date: e.date || report.reportDate, guardName: e.guardName, timeSlot: e.timeSlot, checkpointRange };
    e.checkpointStatuses.forEach((status, idx) => {
      row[`cp${idx + 1}`] = status;
    });
    sheet.addRow(row);
  });
  sheet.getRow(1).font = { bold: true };

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=patrol-report-${report.projectName}-${filenameDate}.xlsx`);
  await workbook.xlsx.write(res);
  res.end();
};

// Guard KPI for the generic (non-Garden-City) patrol sites, using each
// site's real fixed night-round schedule (see NIGHT_SCHEDULES in
// patrolRoundSla.js) rather than a coordinator-typed label or a
// guard-relative anchor — both turned out not to reliably reflect reality.
exports.getGuardKpi = async (req, res) => {
  const { projectSlug, from, to } = req.query;
  if (!projectSlug || !from || !to) {
    return res.status(400).json({ message: "projectSlug, from and to are required" });
  }

  const project = await Project.findOne({ slug: projectSlug });
  if (!project) return res.status(404).json({ message: "Project not found" });

  const checkpoints = await Checkpoint.find({ projectId: project._id }).sort({ order: 1 });
  const checkpointLabel = (id) => checkpoints.find((c) => c.checkpointId === id)?.name || `Checkpoint ${id}`;

  const rows = await computeFixedHourGuardKpi({
    projectId: project._id,
    projectSlug,
    from,
    to,
    checkpointCount: project.checkpointCount,
  });

  const formatted = rows.map((r) => ({
    ...r,
    lateDetails: r.lateDetails.map((d) => ({
      date: d.date,
      checkpointLabel: checkpointLabel(d.checkpointId),
      scheduledTime: `Round ${d.roundStart.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })}`,
      lateByMinutes: d.lateByMinutes,
    })),
  }));

  res.json({ rows: formatted });
};

exports.exportReportPdf = async (req, res) => {
  const report = await PatrolDailyReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });

  const filenameDate = dateRangeLabel(report).replace(/\s+/g, "");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=patrol-report-${report.projectName}-${filenameDate}.pdf`);

  const doc = buildCheckpointReportPdf(report);
  doc.pipe(res);
  doc.end();
};
