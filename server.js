// TEMP diagnostic — remove after the measurement window. Captures how long
// this cold start's own require()s took, so we can see how much of Fluid
// Active CPU growth is cold-start module-loading vs actual request work.
const __coldStartT0 = process.hrtime.bigint();

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const { recordMetric } = require("./utils/requestMetrics"); // TEMP diagnostic

// TEMP diagnostic — see note at top of file.
const __coldStartLoadMs = Number(process.hrtime.bigint() - __coldStartT0) / 1e6;
let __coldStartRecorded = false;

const app = express();

// Defers loading a route module — and everything it pulls in (pdfkit,
// exceljs, cloudinary, sharp, ...) — until the first request actually
// reaches that path, instead of every cold start eagerly loading all ~20
// route files' dependencies regardless of which single endpoint was hit.
// The loaded router is cached (memoized) so warm invocations reuse it, same
// as a normal top-level require() would.
function lazyRoute(loader) {
  let router;
  return (req, res, next) => {
    if (!router) router = loader();
    router(req, res, next);
  };
}

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

app.use("/api/auth", lazyRoute(() => require("./routes/auth")));
app.use("/api/users", lazyRoute(() => require("./routes/users")));
app.use("/api/roles", lazyRoute(() => require("./routes/roles")));
app.use("/api/employees", lazyRoute(() => require("./routes/employees")));
app.use("/api/guards", lazyRoute(() => require("./routes/guards")));
app.use("/api/projects", lazyRoute(() => require("./routes/projects")));
app.use("/api/patrol", lazyRoute(() => require("./routes/patrol")));
app.use("/api/patrol-reports", lazyRoute(() => require("./routes/patrolReports")));
app.use("/api/nightguard", lazyRoute(() => require("./routes/nightguard")));
app.use("/api/attendance", lazyRoute(() => require("./routes/attendance")));
app.use("/api/maintenance-staff", lazyRoute(() => require("./routes/maintenanceStaff")));
app.use("/api/site-locations", lazyRoute(() => require("./routes/siteLocations")));
app.use("/api/attendance-scan", lazyRoute(() => require("./routes/attendanceScan")));
app.use("/api/fire-mock-drill", lazyRoute(() => require("./routes/fireMockDrill")));
app.use("/api/gc-housekeeping", lazyRoute(() => require("./routes/gcHousekeeping")));
app.use("/api/gc-housekeeping-report", lazyRoute(() => require("./routes/gcHousekeepingReport")));
app.use("/api/gc-club", lazyRoute(() => require("./routes/gcClub")));
app.use("/api/gc-club-report", lazyRoute(() => require("./routes/gcClubReport")));
app.use("/api/reserve-club", lazyRoute(() => require("./routes/reserveClub")));
app.use("/api/reserve-club-report", lazyRoute(() => require("./routes/reserveClubReport")));
app.use("/api/regal-garden-club", lazyRoute(() => require("./routes/regalGardenClub")));
app.use("/api/regal-garden-club-report", lazyRoute(() => require("./routes/regalGardenClubReport")));
app.use("/api/print-id-cards", lazyRoute(() => require("./routes/idCardPrint")));
app.use("/api/garden-city-patrol-report", lazyRoute(() => require("./routes/gardenCityPatrolReport")));
app.use("/api/media", lazyRoute(() => require("./routes/media")));
app.use("/api/cron", lazyRoute(() => require("./routes/cron")));

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
  const { checkCloudinaryUsageAndAlert } = require("./utils/cloudinaryUsageAlert");
  const { archiveOldMedia } = require("./utils/archiveOldMedia");
  const { runDailyBackup } = require("./utils/dailyBackup");

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
