const { cloudinary, CLOUDINARY_ACCOUNTS } = require("../middleware/upload");
const { uploadToDrive, isConfigured } = require("./googleDrive");
const PatrolSubmission = require("../models/PatrolSubmission");
const NightGuardSubmission = require("../models/NightGuardSubmission");
const AttendanceScan = require("../models/AttendanceScan");
const FireMockDrill = require("../models/FireMockDrill");
const GCHousekeepingSubmission = require("../models/GCHousekeepingSubmission");

// Files older than this move from Cloudinary to Google Drive to free up
// Cloudinary storage, while everything recent stays on Cloudinary (fast CDN,
// no dependency on the Drive account being reachable). The app keeps
// working exactly the same either way — only the URL stored in Mongo
// changes; the field itself is untouched.
const ARCHIVE_AFTER_DAYS = 4;
// Cap per model per run so one tick never runs too long — a large backlog
// just drains a bit more each day.
const BATCH_LIMIT = 50;

function parseCloudinaryUrl(url) {
  const match = url.match(/res\.cloudinary\.com\/([^/]+)\/(image|video|raw)\/upload\/v\d+\/([^?]+)/);
  if (!match) return null;
  const cloudName = match[1];
  const resourceType = match[2];
  const publicId = resourceType === "raw" ? match[3] : match[3].replace(/\.[a-zA-Z0-9]+$/, "");
  return { cloudName, resourceType, publicId };
}

// A file may live on any account in the failover chain — see
// getMainUploadAuth in middleware/upload.js — so deleting it after copying
// to Drive has to authenticate against whichever account its own URL says
// it's actually on, not just assume the primary account.
function authForCloudName(cloudName) {
  const match = CLOUDINARY_ACCOUNTS.find((a) => a.cloud_name === cloudName);
  const { label, ...auth } = match || CLOUDINARY_ACCOUNTS[0];
  return auth;
}

function isCloudinaryUrl(url) {
  return Boolean(url) && url.includes("res.cloudinary.com");
}

// Downloads one Cloudinary file, re-uploads it to Drive, deletes the
// Cloudinary copy, and returns the new URL. Best-effort per file — if this
// throws, the caller should leave that field untouched and try again next
// run rather than lose the reference.
async function archiveOneUrl(url) {
  const parsed = parseCloudinaryUrl(url);
  if (!parsed) return url;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const mimeType = res.headers.get("content-type") || "application/octet-stream";
  const filename = parsed.publicId.split("/").pop();

  const { url: newUrl } = await uploadToDrive({ buffer, filename, mimeType });
  await cloudinary.uploader
    .destroy(parsed.publicId, { resource_type: parsed.resourceType, ...authForCloudName(parsed.cloudName) })
    .catch(() => {});
  return newUrl;
}

async function archivePatrolSubmissions(cutoff) {
  const docs = await PatrolSubmission.find({
    submittedAt: { $lt: cutoff },
    "photos.photoUrl": { $regex: "res\\.cloudinary\\.com" },
  }).limit(BATCH_LIMIT);

  for (const doc of docs) {
    for (const photo of doc.photos) {
      if (!isCloudinaryUrl(photo.photoUrl)) continue;
      try {
        photo.photoUrl = await archiveOneUrl(photo.photoUrl);
      } catch (err) {
        console.error("[archive] PatrolSubmission photo failed", doc._id.toString(), err.message);
      }
    }
    await doc.save();
  }
  return docs.length;
}

async function archiveNightGuardSubmissions(cutoff) {
  const docs = await NightGuardSubmission.find({
    submittedAt: { $lt: cutoff },
    guardPhotoUrl: { $regex: "res\\.cloudinary\\.com" },
  }).limit(BATCH_LIMIT);

  for (const doc of docs) {
    try {
      doc.guardPhotoUrl = await archiveOneUrl(doc.guardPhotoUrl);
      await doc.save();
    } catch (err) {
      console.error("[archive] NightGuardSubmission failed", doc._id.toString(), err.message);
    }
  }
  return docs.length;
}

async function archiveAttendanceScans(cutoff) {
  const docs = await AttendanceScan.find({
    timestamp: { $lt: cutoff },
    photo: { $regex: "res\\.cloudinary\\.com" },
  }).limit(BATCH_LIMIT);

  for (const doc of docs) {
    try {
      doc.photo = await archiveOneUrl(doc.photo);
      await doc.save();
    } catch (err) {
      console.error("[archive] AttendanceScan failed", doc._id.toString(), err.message);
    }
  }
  return docs.length;
}

async function archiveGCHousekeepingSubmissions(cutoff) {
  const docs = await GCHousekeepingSubmission.find({
    submittedAt: { $lt: cutoff },
    "photos.photoUrl": { $regex: "res\\.cloudinary\\.com" },
  }).limit(BATCH_LIMIT);

  for (const doc of docs) {
    for (const photo of doc.photos) {
      if (!isCloudinaryUrl(photo.photoUrl)) continue;
      try {
        photo.photoUrl = await archiveOneUrl(photo.photoUrl);
      } catch (err) {
        console.error("[archive] GCHousekeepingSubmission photo failed", doc._id.toString(), err.message);
      }
    }
    await doc.save();
  }
  return docs.length;
}

async function archiveFireMockDrills(cutoff) {
  // date is a "YYYY-MM-DD" string, not a real Date field, so compare as
  // strings — works fine since ISO-formatted dates sort lexicographically.
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  const docs = await FireMockDrill.find({ date: { $lt: cutoffKey } }).limit(BATCH_LIMIT);

  for (const doc of docs) {
    try {
      if (isCloudinaryUrl(doc.panelPhoto)) doc.panelPhoto = await archiveOneUrl(doc.panelPhoto);
      if (isCloudinaryUrl(doc.reportAttachment)) doc.reportAttachment = await archiveOneUrl(doc.reportAttachment);
      for (let i = 0; i < doc.checklistAttachments.length; i++) {
        if (isCloudinaryUrl(doc.checklistAttachments[i])) {
          doc.checklistAttachments[i] = await archiveOneUrl(doc.checklistAttachments[i]);
        }
      }
      // Videos are left on Cloudinary for now — they can be large enough
      // that buffering the whole file in memory to re-upload isn't safe
      // without streaming support, which this doesn't implement yet.
      await doc.save();
    } catch (err) {
      console.error("[archive] FireMockDrill failed", doc._id.toString(), err.message);
    }
  }
  return docs.length;
}

async function archiveOldMedia() {
  if (!isConfigured()) return;
  const cutoff = new Date(Date.now() - ARCHIVE_AFTER_DAYS * 24 * 60 * 60 * 1000);

  const counts = {
    patrol: await archivePatrolSubmissions(cutoff),
    nightGuard: await archiveNightGuardSubmissions(cutoff),
    attendance: await archiveAttendanceScans(cutoff),
    fireMockDrill: await archiveFireMockDrills(cutoff),
    gcHousekeeping: await archiveGCHousekeepingSubmissions(cutoff),
  };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total > 0) console.log("[archive] processed", counts);
}

module.exports = { archiveOldMedia };
