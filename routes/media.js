const express = require("express");
const router = express.Router();
const asyncHandler = require("../utils/asyncHandler");
const { fetchDriveFile } = require("../utils/googleDrive");

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
