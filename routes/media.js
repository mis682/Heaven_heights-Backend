const express = require("express");
const router = express.Router();
const asyncHandler = require("../utils/asyncHandler");
const { fetchDriveFile } = require("../utils/googleDrive");
const { cloudinary, getMainUploadAuth, CLOUDINARY_ACCOUNTS } = require("../middleware/upload");

// TEMP diagnostic. Remove after checking.
router.get(
  "/_debug-usage",
  asyncHandler(async (req, res) => {
    const results = await Promise.all(
      CLOUDINARY_ACCOUNTS.map(async (acc) => {
        try {
          const usage = await cloudinary.api.usage({ cloud_name: acc.cloud_name, api_key: acc.api_key, api_secret: acc.api_secret });
          return {
            label: acc.label,
            usedPercent: usage.credits?.used_percent ?? null,
            creditsUsed: usage.credits?.usage ?? null,
            creditsLimit: usage.credits?.limit ?? null,
            storageMB: usage.storage?.usage ? (usage.storage.usage / (1024 * 1024)).toFixed(1) : null,
            bandwidthMB: usage.bandwidth?.usage ? (usage.bandwidth.usage / (1024 * 1024)).toFixed(1) : null,
          };
        } catch (err) {
          return { label: acc.label, error: err.message };
        }
      })
    );
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
router.get(
  "/drive/:fileId",
  asyncHandler(async (req, res) => {
    const driveRes = await fetchDriveFile(req.params.fileId);
    res.setHeader("Content-Type", driveRes.headers.get("content-type") || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=86400");
    const reader = driveRes.body;
    for await (const chunk of reader) res.write(chunk);
    res.end();
  })
);

module.exports = router;
