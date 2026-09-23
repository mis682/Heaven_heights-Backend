const express = require("express");
const router = express.Router();
const sharp = require("sharp");
const asyncHandler = require("../utils/asyncHandler");
const { fetchDriveFile } = require("../utils/googleDrive");
const { cloudinary, getMainUploadAuth } = require("../middleware/upload");

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
      const chunks = [];
      for await (const chunk of driveRes.body) chunks.push(chunk);
      const resized = await sharp(Buffer.concat(chunks))
        .resize(width, width, { fit: "cover" })
        .jpeg({ quality: 80 })
        .toBuffer();
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

// TEMP debug route — remove after use. Measures actual CPU-bound work
// (sharp resize vs pdfkit generation) so the "which uses more Fluid Active
// CPU" question can be answered with numbers instead of guesses.
router.get(
  "/_debug-timing",
  asyncHandler(async (req, res) => {
    const out = {};

    // sharp thumbnail resize, same code path as the real /drive/:fileId?w= route
    const fileId = req.query.fileId;
    if (fileId) {
      const driveRes = await fetchDriveFile(fileId);
      const chunks = [];
      for await (const chunk of driveRes.body) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);
      const t0 = process.hrtime.bigint();
      await sharp(buffer).resize(300, 300, { fit: "cover" }).jpeg({ quality: 80 }).toBuffer();
      const t1 = process.hrtime.bigint();
      out.sharpResizeMs = Number(t1 - t0) / 1e6;
      out.sourceImageKB = Math.round(buffer.length / 1024);
    }

    // Garden City PDF generation, both layouts, on a real report
    const reportId = req.query.reportId;
    if (reportId) {
      const GardenCityPatrolReport = require("../models/GardenCityPatrolReport");
      const { buildGardenCityReportPdf, buildGardenCityReportPdfCard } = require("../utils/gardenCityReportPdf");
      const report = await GardenCityPatrolReport.findById(reportId);
      if (report) {
        const t2 = process.hrtime.bigint();
        const classicDoc = buildGardenCityReportPdf(report);
        classicDoc.end();
        const t3 = process.hrtime.bigint();
        out.classicPdfMs = Number(t3 - t2) / 1e6;

        const t4 = process.hrtime.bigint();
        const cardDoc = buildGardenCityReportPdfCard(report);
        cardDoc.end();
        const t5 = process.hrtime.bigint();
        out.cardPdfMs = Number(t5 - t4) / 1e6;
        out.entryCount = report.entries.length;
      }
    }

    res.json(out);
  })
);

module.exports = router;
