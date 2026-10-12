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

// TEMP debug route — counts documents still holding the stale Drive-proxy
// URL host (from the SERVER_BASE_URL misconfiguration) across every model.
// Remove after the bulk-fix is confirmed.
router.get(
  "/_debug-stale-drive-urls",
  asyncHandler(async (req, res) => {
    const STALE = "https://heaven-heights.onrender.com/api/media/drive/";
    const PatrolSubmission = require("../models/PatrolSubmission");
    const NightGuardSubmission = require("../models/NightGuardSubmission");
    const AttendanceScan = require("../models/AttendanceScan");
    const FireMockDrill = require("../models/FireMockDrill");
    const GCHousekeepingSubmission = require("../models/GCHousekeepingSubmission");
    const GCClubSubmission = require("../models/GCClubSubmission");
    const ReserveClubSubmission = require("../models/ReserveClubSubmission");
    const RegalGardenClubSubmission = require("../models/RegalGardenClubSubmission");
    const OneBusinessCenterSubmission = require("../models/OneBusinessCenterSubmission");
    const MaintenanceUniformSubmission = require("../models/MaintenanceUniformSubmission");

    const countArrayField = async (Model) => {
      const docs = await Model.find({ "photos.photoUrl": { $regex: "^" + STALE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") } })
        .select("photos.photoUrl")
        .lean();
      return docs.reduce((sum, d) => sum + d.photos.filter((p) => p.photoUrl?.startsWith(STALE)).length, 0);
    };
    const countSingleField = (Model, field) => Model.countDocuments({ [field]: { $regex: "^" + STALE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") } });

    const [patrol, nightGuard, attendance, fireMockDrillDocs, gcHousekeeping, gcClub, reserveClub, regalGardenClub, oneBusinessCenter, maintenanceUniform] =
      await Promise.all([
        countArrayField(PatrolSubmission),
        countSingleField(NightGuardSubmission, "guardPhotoUrl"),
        countSingleField(AttendanceScan, "photo"),
        FireMockDrill.find({
          $or: [
            { panelPhoto: { $regex: "^" + STALE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") } },
            { reportAttachment: { $regex: "^" + STALE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") } },
            { checklistAttachments: { $regex: "^" + STALE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") } },
          ],
        })
          .select("panelPhoto reportAttachment checklistAttachments")
          .lean(),
        countArrayField(GCHousekeepingSubmission),
        countArrayField(GCClubSubmission),
        countArrayField(ReserveClubSubmission),
        countArrayField(RegalGardenClubSubmission),
        countArrayField(OneBusinessCenterSubmission),
        countSingleField(MaintenanceUniformSubmission, "photoUrl"),
      ]);

    const fireMockDrill = fireMockDrillDocs.reduce((sum, d) => {
      let n = 0;
      if (d.panelPhoto?.startsWith(STALE)) n += 1;
      if (d.reportAttachment?.startsWith(STALE)) n += 1;
      n += d.checklistAttachments.filter((u) => u?.startsWith(STALE)).length;
      return sum + n;
    }, 0);

    const byModel = { patrol, nightGuard, attendance, fireMockDrill, gcHousekeeping, gcClub, reserveClub, regalGardenClub, oneBusinessCenter, maintenanceUniform };
    const total = Object.values(byModel).reduce((a, b) => a + b, 0);
    res.json({ total, byModel });
  })
);

// TEMP one-off fix route — rewrites the stale SERVER_BASE_URL host
// (heaven-heights.onrender.com, which isn't even this app) to the real one
// (heaven-heights-backend.onrender.com) across every Drive-proxy URL
// already stored in Mongo. Only the host prefix changes — the rest of the
// URL (path + fileId) is untouched. Requires ?confirm=yes-fix-stale-urls so
// it can't be triggered by an accidental GET/crawl. Remove after running.
router.post(
  "/_fix-stale-drive-urls",
  asyncHandler(async (req, res) => {
    if (req.query.confirm !== "yes-fix-stale-urls") {
      return res.status(400).json({ message: "Pass ?confirm=yes-fix-stale-urls to run this." });
    }

    const OLD_HOST = "https://heaven-heights.onrender.com";
    const NEW_HOST = "https://heaven-heights-backend.onrender.com";
    const escaped = OLD_HOST.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const PatrolSubmission = require("../models/PatrolSubmission");
    const NightGuardSubmission = require("../models/NightGuardSubmission");
    const AttendanceScan = require("../models/AttendanceScan");
    const FireMockDrill = require("../models/FireMockDrill");
    const GCHousekeepingSubmission = require("../models/GCHousekeepingSubmission");
    const GCClubSubmission = require("../models/GCClubSubmission");
    const ReserveClubSubmission = require("../models/ReserveClubSubmission");
    const RegalGardenClubSubmission = require("../models/RegalGardenClubSubmission");
    const OneBusinessCenterSubmission = require("../models/OneBusinessCenterSubmission");
    const MaintenanceUniformSubmission = require("../models/MaintenanceUniformSubmission");

    const replaceExpr = (fieldPath) => ({
      $cond: [
        { $eq: [{ $indexOfBytes: [fieldPath, OLD_HOST] }, 0] },
        { $replaceOne: { input: fieldPath, find: OLD_HOST, replacement: NEW_HOST } },
        fieldPath,
      ],
    });

    const fixArrayField = (Model) =>
      Model.updateMany({ "photos.photoUrl": { $regex: "^" + escaped } }, [
        {
          $set: {
            photos: {
              $map: {
                input: "$photos",
                as: "p",
                in: { $mergeObjects: ["$$p", { photoUrl: replaceExpr("$$p.photoUrl") }] },
              },
            },
          },
        },
      ]);

    const fixSingleField = (Model, field) =>
      Model.updateMany({ [field]: { $regex: "^" + escaped } }, [{ $set: { [field]: replaceExpr(`$${field}`) } }]);

    const results = await Promise.all([
      fixArrayField(PatrolSubmission),
      fixSingleField(NightGuardSubmission, "guardPhotoUrl"),
      fixSingleField(AttendanceScan, "photo"),
      FireMockDrill.updateMany(
        {
          $or: [
            { panelPhoto: { $regex: "^" + escaped } },
            { reportAttachment: { $regex: "^" + escaped } },
            { checklistAttachments: { $regex: "^" + escaped } },
          ],
        },
        [
          {
            $set: {
              panelPhoto: replaceExpr("$panelPhoto"),
              reportAttachment: replaceExpr("$reportAttachment"),
              checklistAttachments: {
                $map: { input: "$checklistAttachments", as: "u", in: replaceExpr("$$u") },
              },
            },
          },
        ]
      ),
      fixArrayField(GCHousekeepingSubmission),
      fixArrayField(GCClubSubmission),
      fixArrayField(ReserveClubSubmission),
      fixArrayField(RegalGardenClubSubmission),
      fixArrayField(OneBusinessCenterSubmission),
      fixSingleField(MaintenanceUniformSubmission, "photoUrl"),
    ]);

    const [patrol, nightGuard, attendance, fireMockDrill, gcHousekeeping, gcClub, reserveClub, regalGardenClub, oneBusinessCenter, maintenanceUniform] =
      results.map((r) => r.modifiedCount);

    res.json({
      modifiedDocs: { patrol, nightGuard, attendance, fireMockDrill, gcHousekeeping, gcClub, reserveClub, regalGardenClub, oneBusinessCenter, maintenanceUniform },
      totalModifiedDocs: results.reduce((a, r) => a + r.modifiedCount, 0),
    });
  })
);

module.exports = router;
