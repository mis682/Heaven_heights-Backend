const zlib = require("zlib");
const { uploadToDrive, isConfigured: isDriveConfigured } = require("./googleDrive");
const { sendAlertEmail } = require("./mailer");
const { istDateKey } = require("./istDateRange");
const BackupState = require("../models/BackupState");

const Employee = require("../models/Employee");
const Guard = require("../models/Guard");
const Project = require("../models/Project");
const Checkpoint = require("../models/Checkpoint");
const PatrolSubmission = require("../models/PatrolSubmission");
const NightGuardSubmission = require("../models/NightGuardSubmission");
const Attendance = require("../models/Attendance");
const SiteLocation = require("../models/SiteLocation");
const AttendanceScan = require("../models/AttendanceScan");
const GardenCityPatrolReport = require("../models/GardenCityPatrolReport");
const FireMockDrill = require("../models/FireMockDrill");
const PatrolDailyReport = require("../models/PatrolDailyReport");
const NightGuardDailyReport = require("../models/NightGuardDailyReport");
const MaintenanceStaff = require("../models/MaintenanceStaff");
const AttendanceOverride = require("../models/AttendanceOverride");

// Every collection that holds real business data — CloudinaryAlertState is
// deliberately excluded, it's internal bookkeeping for the usage-alert
// cron, not something anyone would restore from a backup.
const COLLECTIONS = {
  employees: Employee,
  guards: Guard,
  projects: Project,
  checkpoints: Checkpoint,
  patrolSubmissions: PatrolSubmission,
  nightGuardSubmissions: NightGuardSubmission,
  attendance: Attendance,
  siteLocations: SiteLocation,
  attendanceScans: AttendanceScan,
  gardenCityPatrolReports: GardenCityPatrolReport,
  fireMockDrills: FireMockDrill,
  patrolDailyReports: PatrolDailyReport,
  nightGuardDailyReports: NightGuardDailyReport,
  maintenanceStaff: MaintenanceStaff,
  attendanceOverrides: AttendanceOverride,
};

// Resend rejects requests above ~40MB; stop attaching well before that so a
// bad day never silently fails to email at all — the Drive copy still goes
// up regardless, so nothing is lost either way.
const MAX_EMAIL_ATTACHMENT_BYTES = 20 * 1024 * 1024;

async function buildBackup() {
  const data = {};
  const counts = {};
  for (const [key, model] of Object.entries(COLLECTIONS)) {
    const docs = await model.find({}).lean();
    data[key] = docs;
    counts[key] = docs.length;
  }
  return { generatedAt: new Date().toISOString(), counts, data };
}

async function runDailyBackup() {
  // Runs once at every server startup as a safety net (see server.js), so a
  // Render redeploy — which restarts the process — must not re-send the
  // same day's backup email. Only proceed if today's backup hasn't gone
  // out yet.
  const todayKey = istDateKey(new Date());
  let state = await BackupState.findOne();
  if (!state) state = await BackupState.create({});
  if (state.lastBackupDate === todayKey) {
    console.log(`[daily-backup] already sent for ${todayKey}, skipping`);
    return;
  }

  const backup = await buildBackup();
  const dateKey = todayKey;
  const json = JSON.stringify(backup);
  const gzipped = zlib.gzipSync(json);
  const filename = `heaven-heights-backup-${dateKey}.json.gz`;

  let driveUrl = null;
  if (isDriveConfigured()) {
    try {
      const { url } = await uploadToDrive({
        buffer: gzipped,
        filename,
        mimeType: "application/gzip",
        folderId: process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID,
      });
      driveUrl = url;
    } catch (err) {
      console.error("[daily-backup] Drive upload failed", err.message);
    }
  }

  const totalRecords = Object.values(backup.counts).reduce((a, b) => a + b, 0);
  const countLines = Object.entries(backup.counts)
    .map(([key, count]) => `${key}: ${count}`)
    .join("\n");

  // The same bytes going out twice — once to Drive, once as an email
  // attachment — was pure waste on a normal day: Drive is the actual
  // restore-from copy, the email was never used to restore anything.
  // Only fall back to attaching when Drive genuinely isn't available that
  // day (not configured, or the upload failed), so a bad day still doesn't
  // silently go unbacked-up anywhere.
  const canAttach = !driveUrl && gzipped.length <= MAX_EMAIL_ATTACHMENT_BYTES;
  const driveDown = !driveUrl;

  await sendAlertEmail({
    subject: `Daily backup — ${dateKey} — Heaven Heights`,
    text:
      `Daily backup for ${dateKey}.\n\n` +
      `Total records: ${totalRecords}\n${countLines}\n\n` +
      (driveUrl
        ? `Saved to Drive: ${driveUrl}\n`
        : canAttach
        ? "Drive upload unavailable today — full backup attached (gzipped JSON) instead.\n"
        : "Drive upload unavailable today, and the backup is too large to attach — this day's backup was NOT saved anywhere. Check Drive configuration.\n"),
    html:
      `<p>Daily backup for <b>${dateKey}</b>.</p>` +
      `<p>Total records: <b>${totalRecords}</b></p>` +
      `<pre>${countLines}</pre>` +
      (driveUrl
        ? `<p>Saved to Drive: <a href="${driveUrl}">${driveUrl}</a></p>`
        : canAttach
        ? "<p>Drive upload unavailable today — full backup attached (gzipped JSON) instead.</p>"
        : "<p><b>Drive upload unavailable today, and the backup is too large to attach — this day's backup was NOT saved anywhere. Check Drive configuration.</b></p>"),
    attachments: canAttach ? [{ filename, content: gzipped }] : undefined,
  });

  if (driveDown) console.warn(`[daily-backup] ${dateKey}: Drive unavailable, fell back to email attachment=${canAttach}`);

  state.lastBackupDate = todayKey;
  await state.save();

  console.log(`[daily-backup] ${dateKey}: ${totalRecords} records, drive=${Boolean(driveUrl)}, emailed=true`);
}

module.exports = { runDailyBackup };
