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

// TEMP debug route — exact per-day archived-file counts, read straight from
// Google Drive's own file metadata (createdTime), not a derived estimate.
// Every file archiveOldMedia.js ever moved to Drive still has its real
// creation timestamp there, so this works for any past day, not just ones
// we happened to snapshot live — read-only, no mutation. Remove after
// checking.
router.get(
  "/_debug-archived-count",
  asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days, 10) || 10;
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) return res.status(500).json({ error: "token fetch failed", detail: tokenData });

    async function countForDay(dateStr) {
      const start = `${dateStr}T00:00:00Z`;
      const endDateObj = new Date(dateStr + "T00:00:00Z");
      endDateObj.setUTCDate(endDateObj.getUTCDate() + 1);
      const end = endDateObj.toISOString().slice(0, 19) + "Z";
      const q = `'${folderId}' in parents and createdTime >= '${start}' and createdTime < '${end}' and trashed = false`;

      let count = 0;
      let pageToken;
      do {
        const url = new URL("https://www.googleapis.com/drive/v3/files");
        url.searchParams.set("q", q);
        url.searchParams.set("fields", "nextPageToken, files(id)");
        url.searchParams.set("pageSize", "1000");
        if (pageToken) url.searchParams.set("pageToken", pageToken);
        const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        const d = await r.json();
        count += (d.files || []).length;
        pageToken = d.nextPageToken;
      } while (pageToken);
      return count;
    }

    const results = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const count = await countForDay(dateStr);
      results.push({ date: dateStr, count });
    }
    res.json(results);
  })
);

module.exports = router;
