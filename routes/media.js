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

// TEMP debug route — reads the per-run archival diagnostic log — remove
// after root-causing the stuck-backlog issue.
router.get(
  "/_debug-archive-log",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const ArchiveDebugLog =
      mongoose.models.ArchiveDebugLog ||
      mongoose.model("ArchiveDebugLog", new mongoose.Schema({}, { strict: false, timestamps: true }));
    const docs = await ArchiveDebugLog.find({}).sort({ createdAt: -1 }).limit(10).lean();
    res.json(docs);
  })
);

// TEMP debug route — counts the archive backlog — remove after checking.
router.get(
  "/_debug-backlog",
  asyncHandler(async (req, res) => {
    const PatrolSubmission = require("../models/PatrolSubmission");
    const AttendanceScan = require("../models/AttendanceScan");
    const GCHousekeepingSubmission = require("../models/GCHousekeepingSubmission");
    const GCClubSubmission = require("../models/GCClubSubmission");

    const ARCHIVE_AFTER_DAYS = 4;
    const cutoff = new Date(Date.now() - ARCHIVE_AFTER_DAYS * 24 * 60 * 60 * 1000);
    const isCloudinary = (url) => Boolean(url) && url.includes("res.cloudinary.com");

    async function countPhotosArray(Model, dateField) {
      const docs = await Model.find(
        { [dateField]: { $lt: cutoff }, "photos.photoUrl": { $regex: "res\\.cloudinary\\.com" } },
        { photos: 1 }
      ).lean();
      let count = 0;
      for (const doc of docs) for (const p of doc.photos) if (isCloudinary(p.photoUrl)) count++;
      return count;
    }

    const [patrol, attendance, gcHousekeeping, gcClub] = await Promise.all([
      countPhotosArray(PatrolSubmission, "submittedAt"),
      AttendanceScan.countDocuments({ timestamp: { $lt: cutoff }, photo: { $regex: "res\\.cloudinary\\.com" } }),
      countPhotosArray(GCHousekeepingSubmission, "submittedAt"),
      countPhotosArray(GCClubSubmission, "submittedAt"),
    ]);

    res.json({ patrol, attendance, gcHousekeeping, gcClub, total: patrol + attendance + gcHousekeeping + gcClub });
  })
);

module.exports = router;
