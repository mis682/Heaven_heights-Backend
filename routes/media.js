const express = require("express");
const router = express.Router();
const asyncHandler = require("../utils/asyncHandler");
const { fetchDriveFile } = require("../utils/googleDrive");
const { cloudinary, getMainUploadAuth } = require("../middleware/upload");
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

// TEMP debug route — total incoming photos per day, across all modules,
// counted from each submission's own date field (not backlog/archive state)
// — remove after checking.
router.get(
  "/_debug-daily-photos",
  asyncHandler(async (req, res) => {
    const PatrolSubmission = require("../models/PatrolSubmission");
    const NightGuardSubmission = require("../models/NightGuardSubmission");
    const AttendanceScan = require("../models/AttendanceScan");
    const FireMockDrill = require("../models/FireMockDrill");
    const GCHousekeepingSubmission = require("../models/GCHousekeepingSubmission");
    const GCClubSubmission = require("../models/GCClubSubmission");
    const ReserveClubSubmission = require("../models/ReserveClubSubmission");
    const RegalGardenClubSubmission = require("../models/RegalGardenClubSubmission");

    const days = parseInt(req.query.days, 10) || 7;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    async function countPhotosArrayForDay(Model, dateField, start, end) {
      const docs = await Model.find({ [dateField]: { $gte: start, $lt: end } }, { photos: 1 }).lean();
      return docs.reduce((sum, d) => sum + (d.photos?.length || 0), 0);
    }

    const results = [];
    for (let i = days - 1; i >= 0; i--) {
      const start = new Date(today);
      start.setUTCDate(start.getUTCDate() - i);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      const dateKey = start.toISOString().slice(0, 10);

      const [patrol, nightGuard, attendance, gcHousekeeping, gcClub, reserveClub, regalGardenClub, fireMockDocs] = await Promise.all([
        countPhotosArrayForDay(PatrolSubmission, "submittedAt", start, end),
        NightGuardSubmission.countDocuments({ submittedAt: { $gte: start, $lt: end }, guardPhotoUrl: { $exists: true, $ne: "" } }),
        AttendanceScan.countDocuments({ timestamp: { $gte: start, $lt: end }, photo: { $exists: true, $ne: "" } }),
        countPhotosArrayForDay(GCHousekeepingSubmission, "submittedAt", start, end),
        countPhotosArrayForDay(GCClubSubmission, "submittedAt", start, end),
        countPhotosArrayForDay(ReserveClubSubmission, "submittedAt", start, end),
        countPhotosArrayForDay(RegalGardenClubSubmission, "submittedAt", start, end),
        FireMockDrill.find(
          { date: dateKey },
          { panelPhoto: 1, reportAttachment: 1, checklistAttachments: 1 }
        ).lean(),
      ]);

      let fireMockDrill = 0;
      for (const doc of fireMockDocs) {
        if (doc.panelPhoto) fireMockDrill++;
        if (doc.reportAttachment) fireMockDrill++;
        fireMockDrill += (doc.checklistAttachments || []).length;
      }

      const total = patrol + nightGuard + attendance + fireMockDrill + gcHousekeeping + gcClub + reserveClub + regalGardenClub;
      results.push({ date: dateKey, patrol, nightGuard, attendance, fireMockDrill, gcHousekeeping, gcClub, reserveClub, regalGardenClub, total });
    }

    res.json(results);
  })
);

module.exports = router;
