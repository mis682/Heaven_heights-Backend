const express = require("express");
const router = express.Router();
const sharp = require("sharp");
const asyncHandler = require("../utils/asyncHandler");
const { fetchDriveFile } = require("../utils/googleDrive");
const { cloudinary, getMainUploadAuth, CLOUDINARY_ACCOUNTS } = require("../middleware/upload");

// TEMP diagnostic. Remove after checking.
router.get(
  "/_debug-daily-usage",
  asyncHandler(async (req, res) => {
    const label = req.query.label || "Housekeeping";
    const acc = CLOUDINARY_ACCOUNTS.find((a) => a.label === label);
    if (!acc) return res.status(404).json({ message: "account not found", available: CLOUDINARY_ACCOUNTS.map((a) => a.label) });
    const fromDay = parseInt(req.query.from || "1", 10);
    const toDay = parseInt(req.query.to || "19", 10);
    const results = [];
    for (let d = fromDay; d <= toDay; d++) {
      const date = `2026-09-${String(d).padStart(2, "0")}`;
      try {
        const usage = await cloudinary.api.usage({ date, cloud_name: acc.cloud_name, api_key: acc.api_key, api_secret: acc.api_secret });
        results.push({
          date,
          credits: usage.credits?.usage ?? null,
          storageMB: usage.storage?.usage ? (usage.storage.usage / (1024 * 1024)).toFixed(1) : null,
          bandwidthMB: usage.bandwidth?.usage ? (usage.bandwidth.usage / (1024 * 1024)).toFixed(1) : null,
        });
      } catch (err) {
        results.push({ date, error: err.message });
      }
    }
    res.json(results);
  })
);

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

module.exports = router;
