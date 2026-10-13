const express = require("express");
const router = express.Router();
const asyncHandler = require("../utils/asyncHandler");
const { fetchDriveFile, countFilesCreatedBetween } = require("../utils/googleDrive");
const { cloudinary, getMainUploadAuth, CLOUDINARY_ACCOUNTS } = require("../middleware/upload");
const { recordMetric } = require("../utils/requestMetrics"); // TEMP diagnostic

const IMAGE_TRANSFORMATION = "w_1600,h_1600,c_limit,q_auto:good,f_auto";
const FOLDERS = { main: "heaven-heights", housekeeping: "heaven-heights-housekeeping" };

// Hands out a short-lived signed Cloudinary upload authorization instead of
// relaying the file itself — the browser uploads straight to Cloudinary
// with this, so a serverless function's execution-time limit is never in
// the path of a large or slow multi-photo submission. `account` only picks
// the upload *folder* now — housekeeping/hospitality forms share the same
// failover-aware credential pool as everything else (getMainUploadAuth),
// so a full Housekeeping-tier account doesn't strand them with nowhere to
// go while Fallback 3/4/5 sit unused.
router.post(
  "/upload-signature",
  asyncHandler(async (req, res) => {
    const { account = "main", resourceType = "image" } = req.body;
    const auth = await getMainUploadAuth();
    const folder = FOLDERS[account] || FOLDERS.main;
    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign = { timestamp, folder };
    if (resourceType === "image") paramsToSign.transformation = IMAGE_TRANSFORMATION;

    const signature = cloudinary.utils.api_sign_request(paramsToSign, auth.api_secret);
    res.json({
      signature,
      timestamp,
      apiKey: auth.api_key,
      cloudName: auth.cloud_name,
      folder,
      transformation: paramsToSign.transformation || null,
    });
  })
);

// Proxies an archived file's bytes from Google Drive — the file itself
// stays private on Drive (this Workspace blocks public link-sharing), this
// server holds the only credential that can read it and streams it through.
//
// An optional ?w= resizes on the fly (mirrors Cloudinary's thumbnail
// transform — see client's cloudinaryThumbnailUrl) instead of always
// shipping the full ~1600px original just to fill a small grid thumbnail.
// The resized result is cached exactly like the original (see headers
// below), so this only actually runs sharp once per distinct file+width.
router.get(
  "/drive/:fileId",
  asyncHandler(async (req, res) => {
    const driveRes = await fetchDriveFile(req.params.fileId);
    const contentType = driveRes.headers.get("content-type") || "application/octet-stream";
    const width = parseInt(req.query.w, 10);

    // Archived files are historical records — once written, they never
    // change — so there's no reason to ever re-fetch the same one from
    // Drive through this proxy. `immutable` skips revalidation entirely;
    // s-maxage lets Vercel's edge cache serve repeat views to *any*
    // visitor (not just the same browser) without this function running
    // again, cutting the origin-transfer cost of viewing the same archived
    // photo more than once.
    res.setHeader("Cache-Control", "public, max-age=31536000, s-maxage=31536000, immutable");

    if (width > 0 && contentType.startsWith("image/")) {
      const sharp = require("sharp"); // lazy — only this endpoint needs it
      const chunks = [];
      for await (const chunk of driveRes.body) chunks.push(chunk);
      const __t0 = process.hrtime.bigint(); // TEMP diagnostic
      const resized = await sharp(Buffer.concat(chunks))
        .resize(width, width, { fit: "cover" })
        .jpeg({ quality: 80 })
        .toBuffer();
      recordMetric("thumbnail", Number(process.hrtime.bigint() - __t0) / 1e6); // TEMP diagnostic
      res.setHeader("Content-Type", "image/jpeg");
      res.send(resized);
      return;
    }

    res.setHeader("Content-Type", contentType);
    const reader = driveRes.body;
    for await (const chunk of reader) res.write(chunk);
    res.end();
  })
);

// TEMP debug route — remove after the measurement window.
router.get(
  "/_debug-metrics",
  asyncHandler(async (req, res) => {
    const { RequestMetric } = require("../utils/requestMetrics");
    const docs = await RequestMetric.find({}).sort({ date: 1, type: 1 }).lean();
    res.json(docs);
  })
);

// Read-only Cloudinary usage check across every account in the failover
// chain — kept permanently (not a TEMP route) since this gets checked
// often; only exposes aggregate usage %, never the credentials themselves.
router.get(
  "/cloudinary-usage",
  asyncHandler(async (req, res) => {
    const results = await Promise.all(
      CLOUDINARY_ACCOUNTS.map(async (account) => {
        try {
          const usage = await cloudinary.api.usage({
            cloud_name: account.cloud_name,
            api_key: account.api_key,
            api_secret: account.api_secret,
          });
          return {
            label: account.label,
            cloud_name: account.cloud_name,
            credits_used: usage.credits?.usage,
            credits_limit: usage.credits?.limit,
            credits_used_percent: usage.credits?.used_percent,
          };
        } catch (err) {
          return { label: account.label, cloud_name: account.cloud_name, error: err.message };
        }
      })
    );
    res.json(results);
  })
);

// Read-only count of total un-archived (still-on-Cloudinary) photos across
// every model, regardless of age/health — kept permanently (same reasoning
// as /cloudinary-usage) since this gets checked often.
router.get(
  "/backlog",
  asyncHandler(async (req, res) => {
    const isCloudinaryUrl = (url) => Boolean(url) && url.includes("res.cloudinary.com");
    const PatrolSubmission = require("../models/PatrolSubmission");
    const NightGuardSubmission = require("../models/NightGuardSubmission");
    const AttendanceScan = require("../models/AttendanceScan");
    const FireMockDrill = require("../models/FireMockDrill");
    const GCHousekeepingSubmission = require("../models/GCHousekeepingSubmission");
    const GCClubSubmission = require("../models/GCClubSubmission");
    const ReserveClubSubmission = require("../models/ReserveClubSubmission");
    const RegalGardenClubSubmission = require("../models/RegalGardenClubSubmission");
    const OneBusinessCenterSubmission = require("../models/OneBusinessCenterSubmission");
    const NatureParkSubmission = require("../models/NatureParkSubmission");
    const MaintenanceUniformSubmission = require("../models/MaintenanceUniformSubmission");

    const countArrayField = async (Model) => {
      const docs = await Model.find({ "photos.photoUrl": { $regex: "res\\.cloudinary\\.com" } })
        .select("photos.photoUrl")
        .lean();
      return docs.reduce((sum, d) => sum + d.photos.filter((p) => isCloudinaryUrl(p.photoUrl)).length, 0);
    };
    const countSingleField = (Model, field) => Model.countDocuments({ [field]: { $regex: "res\\.cloudinary\\.com" } });

    const [
      patrol,
      nightGuard,
      attendance,
      fireMockDrillDocs,
      gcHousekeeping,
      gcClub,
      reserveClub,
      regalGardenClub,
      oneBusinessCenter,
      naturePark,
      maintenanceUniform,
    ] = await Promise.all([
      countArrayField(PatrolSubmission),
      countSingleField(NightGuardSubmission, "guardPhotoUrl"),
      countSingleField(AttendanceScan, "photo"),
      FireMockDrill.find({
        $or: [
          { panelPhoto: { $regex: "res\\.cloudinary\\.com" } },
          { reportAttachment: { $regex: "res\\.cloudinary\\.com" } },
          { checklistAttachments: { $regex: "res\\.cloudinary\\.com" } },
        ],
      })
        .select("panelPhoto reportAttachment checklistAttachments")
        .lean(),
      countArrayField(GCHousekeepingSubmission),
      countArrayField(GCClubSubmission),
      countArrayField(ReserveClubSubmission),
      countArrayField(RegalGardenClubSubmission),
      countArrayField(OneBusinessCenterSubmission),
      countArrayField(NatureParkSubmission),
      countSingleField(MaintenanceUniformSubmission, "photoUrl"),
    ]);

    const fireMockDrill = fireMockDrillDocs.reduce((sum, d) => {
      let n = 0;
      if (isCloudinaryUrl(d.panelPhoto)) n += 1;
      if (isCloudinaryUrl(d.reportAttachment)) n += 1;
      n += d.checklistAttachments.filter(isCloudinaryUrl).length;
      return sum + n;
    }, 0);

    const byModel = {
      patrol,
      nightGuard,
      attendance,
      fireMockDrill,
      gcHousekeeping,
      gcClub,
      reserveClub,
      regalGardenClub,
      oneBusinessCenter,
      naturePark,
      maintenanceUniform,
    };
    const total = Object.values(byModel).reduce((a, b) => a + b, 0);
    res.json({ total, byModel });
  })
);

// Daily count of photos archived to Drive over the last N IST days (default
// 10, excludes today since it's not finished yet) — kept permanently (same
// reasoning as /cloudinary-usage and /backlog) since this gets checked
// often. ?days=N to change the window.
router.get(
  "/archived-daily",
  asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days, 10) || 10;
    const todayIstStr = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const results = [];
    for (let i = days; i >= 1; i--) {
      const d = new Date(`${todayIstStr}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const startIso = `${dateStr}T00:00:00+05:30`;
      const end = new Date(`${dateStr}T00:00:00+05:30`);
      end.setUTCDate(end.getUTCDate() + 1);
      const count = await countFilesCreatedBetween(startIso, end.toISOString());
      results.push({ date: dateStr, archivedCount: count });
    }
    res.json(results);
  })
);

// Daily count of NEW photos submitted (regardless of current storage —
// still-on-Cloudinary or already archived to Drive) across every module
// combined, over the last N IST days (default 10, excludes today since it's
// not finished yet) — kept permanently (same reasoning as the other stats
// routes above) since this gets checked often. ?days=N to change the window.
router.get(
  "/uploads-daily",
  asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days, 10) || 10;
    const PatrolSubmission = require("../models/PatrolSubmission");
    const NightGuardSubmission = require("../models/NightGuardSubmission");
    const AttendanceScan = require("../models/AttendanceScan");
    const FireMockDrill = require("../models/FireMockDrill");
    const GCHousekeepingSubmission = require("../models/GCHousekeepingSubmission");
    const GCClubSubmission = require("../models/GCClubSubmission");
    const ReserveClubSubmission = require("../models/ReserveClubSubmission");
    const RegalGardenClubSubmission = require("../models/RegalGardenClubSubmission");
    const OneBusinessCenterSubmission = require("../models/OneBusinessCenterSubmission");
    const NatureParkSubmission = require("../models/NatureParkSubmission");
    const MaintenanceUniformSubmission = require("../models/MaintenanceUniformSubmission");

    const todayIstStr = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const istDateStr = (d) => new Date(new Date(d).getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const cutoff = new Date(`${todayIstStr}T00:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - (days + 1)); // +1 day buffer for the IST offset at the edges
    const cutoffDateKey = cutoff.toISOString().slice(0, 10); // FireMockDrill's date is a "YYYY-MM-DD" string

    const perDay = {};
    const addCount = (dateStr, model, n) => {
      if (!n) return;
      if (!perDay[dateStr]) perDay[dateStr] = { date: dateStr, total: 0, byModel: {} };
      perDay[dateStr].total += n;
      perDay[dateStr].byModel[model] = (perDay[dateStr].byModel[model] || 0) + n;
    };

    const [
      patrolDocs,
      nightGuardDocs,
      attendanceDocs,
      fireMockDrillDocs,
      gcHousekeepingDocs,
      gcClubDocs,
      reserveClubDocs,
      regalGardenClubDocs,
      oneBusinessCenterDocs,
      natureParkDocs,
      maintenanceUniformDocs,
    ] = await Promise.all([
      PatrolSubmission.find({ submittedAt: { $gte: cutoff } }).select("submittedAt photos").lean(),
      NightGuardSubmission.find({ submittedAt: { $gte: cutoff } }).select("submittedAt guardPhotoUrl").lean(),
      AttendanceScan.find({ timestamp: { $gte: cutoff } }).select("timestamp photo").lean(),
      FireMockDrill.find({ date: { $gte: cutoffDateKey } }).select("date panelPhoto reportAttachment checklistAttachments").lean(),
      GCHousekeepingSubmission.find({ submittedAt: { $gte: cutoff } }).select("submittedAt photos").lean(),
      GCClubSubmission.find({ submittedAt: { $gte: cutoff } }).select("submittedAt photos").lean(),
      ReserveClubSubmission.find({ submittedAt: { $gte: cutoff } }).select("submittedAt photos").lean(),
      RegalGardenClubSubmission.find({ submittedAt: { $gte: cutoff } }).select("submittedAt photos").lean(),
      OneBusinessCenterSubmission.find({ submittedAt: { $gte: cutoff } }).select("submittedAt photos").lean(),
      NatureParkSubmission.find({ submittedAt: { $gte: cutoff } }).select("submittedAt photos").lean(),
      MaintenanceUniformSubmission.find({ submittedAt: { $gte: cutoff } }).select("submittedAt photoUrl").lean(),
    ]);

    patrolDocs.forEach((d) => addCount(istDateStr(d.submittedAt), "patrol", (d.photos || []).length));
    nightGuardDocs.forEach((d) => addCount(istDateStr(d.submittedAt), "nightGuard", d.guardPhotoUrl ? 1 : 0));
    attendanceDocs.forEach((d) => addCount(istDateStr(d.timestamp), "attendance", d.photo ? 1 : 0));
    fireMockDrillDocs.forEach((d) => {
      let n = 0;
      if (d.panelPhoto) n += 1;
      if (d.reportAttachment) n += 1;
      n += (d.checklistAttachments || []).filter(Boolean).length;
      addCount(d.date, "fireMockDrill", n);
    });
    gcHousekeepingDocs.forEach((d) => addCount(istDateStr(d.submittedAt), "gcHousekeeping", (d.photos || []).length));
    gcClubDocs.forEach((d) => addCount(istDateStr(d.submittedAt), "gcClub", (d.photos || []).length));
    reserveClubDocs.forEach((d) => addCount(istDateStr(d.submittedAt), "reserveClub", (d.photos || []).length));
    regalGardenClubDocs.forEach((d) => addCount(istDateStr(d.submittedAt), "regalGardenClub", (d.photos || []).length));
    oneBusinessCenterDocs.forEach((d) => addCount(istDateStr(d.submittedAt), "oneBusinessCenter", (d.photos || []).length));
    natureParkDocs.forEach((d) => addCount(istDateStr(d.submittedAt), "naturePark", (d.photos || []).length));
    maintenanceUniformDocs.forEach((d) => addCount(istDateStr(d.submittedAt), "maintenanceUniform", d.photoUrl ? 1 : 0));

    const results = [];
    for (let i = days; i >= 1; i--) {
      const d = new Date(`${todayIstStr}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      results.push(perDay[dateStr] || { date: dateStr, total: 0, byModel: {} });
    }
    res.json(results);
  })
);

module.exports = router;
