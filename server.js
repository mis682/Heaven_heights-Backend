// TEMP diagnostic — remove after the measurement window. Captures how long
// this cold start's own require()s took, so we can see how much of Fluid
// Active CPU growth is cold-start module-loading vs actual request work.
const __coldStartT0 = process.hrtime.bigint();

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const roleRoutes = require("./routes/roles");
const employeeRoutes = require("./routes/employees");
const guardRoutes = require("./routes/guards");
const projectRoutes = require("./routes/projects");
const patrolRoutes = require("./routes/patrol");
const patrolReportRoutes = require("./routes/patrolReports");
const nightguardRoutes = require("./routes/nightguard");
const attendanceRoutes = require("./routes/attendance");
const maintenanceStaffRoutes = require("./routes/maintenanceStaff");
const siteLocationRoutes = require("./routes/siteLocations");
const attendanceScanRoutes = require("./routes/attendanceScan");
const fireMockDrillRoutes = require("./routes/fireMockDrill");
const gcHousekeepingRoutes = require("./routes/gcHousekeeping");
const gcHousekeepingReportRoutes = require("./routes/gcHousekeepingReport");
const gcClubRoutes = require("./routes/gcClub");
const gcClubReportRoutes = require("./routes/gcClubReport");
const reserveClubRoutes = require("./routes/reserveClub");
const reserveClubReportRoutes = require("./routes/reserveClubReport");
const regalGardenClubRoutes = require("./routes/regalGardenClub");
const regalGardenClubReportRoutes = require("./routes/regalGardenClubReport");
const idCardPrintRoutes = require("./routes/idCardPrint");
const gardenCityPatrolReportRoutes = require("./routes/gardenCityPatrolReport");
const mediaRoutes = require("./routes/media");
const cronRoutes = require("./routes/cron");
const { checkCloudinaryUsageAndAlert } = require("./utils/cloudinaryUsageAlert");
const { archiveOldMedia } = require("./utils/archiveOldMedia");
const { runDailyBackup } = require("./utils/dailyBackup");
const { recordMetric } = require("./utils/requestMetrics"); // TEMP diagnostic

// TEMP diagnostic — see note at top of file.
const __coldStartLoadMs = Number(process.hrtime.bigint() - __coldStartT0) / 1e6;
let __coldStartRecorded = false;

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(express.json());

// A serverless invocation has no long-running startup phase to connect
// once and hold the connection open — this connects on every cold start
// and reuses the cached connection (see config/db.js) on every warm one,
// before any route handler runs.
app.use((req, res, next) => {
  connectDB()
    .then(() => {
      // TEMP diagnostic — fires once per cold instance only.
      if (!__coldStartRecorded) {
        __coldStartRecorded = true;
        recordMetric("coldstart", __coldStartLoadMs);
      }
      next();
    })
    .catch((err) => {
      console.error("[server] failed to connect to MongoDB", err);
      res.status(503).json({ message: "Database unavailable" });
    });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/guards", guardRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/patrol", patrolRoutes);
app.use("/api/patrol-reports", patrolReportRoutes);
app.use("/api/nightguard", nightguardRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/maintenance-staff", maintenanceStaffRoutes);
app.use("/api/site-locations", siteLocationRoutes);
app.use("/api/attendance-scan", attendanceScanRoutes);
app.use("/api/fire-mock-drill", fireMockDrillRoutes);
app.use("/api/gc-housekeeping", gcHousekeepingRoutes);
app.use("/api/gc-housekeeping-report", gcHousekeepingReportRoutes);
app.use("/api/gc-club", gcClubRoutes);
app.use("/api/gc-club-report", gcClubReportRoutes);
app.use("/api/reserve-club", reserveClubRoutes);
app.use("/api/reserve-club-report", reserveClubReportRoutes);
app.use("/api/regal-garden-club", regalGardenClubRoutes);
app.use("/api/regal-garden-club-report", regalGardenClubReportRoutes);
app.use("/api/print-id-cards", idCardPrintRoutes);
app.use("/api/garden-city-patrol-report", gardenCityPatrolReportRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/cron", cronRoutes);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// This deployment only ever serves /api/* — the frontend is a separate
// Vercel project (see frontend/.env.production's VITE_API_URL). Anything
// else hitting this domain directly is someone checking it's alive, not a
// browser navigation to redirect anywhere.
app.get(/^(?!\/api).*/, (req, res) => res.json({ service: "heaven-heights-backend", status: "ok" }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

module.exports = app;

// Vercel imports `app` (via api/index.js) and wraps it as a serverless
// function per-request instead of running this block — a serverless
// function has no persistent process to hold app.listen() or a
// setInterval on, which is also why those periodic tasks moved to
// routes/cron.js, triggered by Vercel Cron instead. This block only runs
// when the file is executed directly (`node server.js`), i.e. local dev.
if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  const CLOUDINARY_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;
  const ARCHIVE_INTERVAL_MS = 24 * 60 * 60 * 1000;
  const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

  connectDB()
    .then(() => {
      app.listen(PORT, () => console.log(`[server] listening on http://localhost:${PORT}`));
      checkCloudinaryUsageAndAlert().catch((err) => console.error("[cloudinary-usage-alert] failed", err));
      setInterval(() => {
        checkCloudinaryUsageAndAlert().catch((err) => console.error("[cloudinary-usage-alert] failed", err));
      }, CLOUDINARY_CHECK_INTERVAL_MS);

      archiveOldMedia().catch((err) => console.error("[archive] failed", err));
      setInterval(() => {
        archiveOldMedia().catch((err) => console.error("[archive] failed", err));
      }, ARCHIVE_INTERVAL_MS);

      runDailyBackup().catch((err) => console.error("[daily-backup] failed", err));
      setInterval(() => {
        runDailyBackup().catch((err) => console.error("[daily-backup] failed", err));
      }, BACKUP_INTERVAL_MS);
    })
    .catch((err) => {
      console.error("[server] failed to connect to MongoDB", err);
      process.exit(1);
    });
}
