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
// A doc-count cap alone isn't a reliable time bound — one PatrolSubmission
// can hold 20 photos, another model's doc just one — so this now also
// tracks a wall-clock budget (see TIME_BUDGET_MS) and stops early once
// spent. BATCH_LIMIT just keeps a single Mongo query from fetching an
// unbounded backlog before that check even gets a chance to run.
const BATCH_LIMIT = 15;

// This runs inside a Vercel Cron serverless invocation (60s ceiling, shared
// with the other daily-cron tasks that run after this one — see
// routes/cron.js), not a long-lived process, so it has to stop itself well
// before that ceiling rather than run until killed mid-file. Leaves a
// backlog to drain a bit more each day rather than trying to force it all
// through in one run.
const TIME_BUDGET_MS = 35000;

function budgetExceeded(startedAt) {
  return Date.now() - startedAt > TIME_BUDGET_MS;
}

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

async function archivePatrolSubmissions(cutoff, startedAt) {
  const docs = await PatrolSubmission.find({
    submittedAt: { $lt: cutoff },
    "photos.photoUrl": { $regex: "res\\.cloudinary\\.com" },
  }).limit(BATCH_LIMIT);

  let processed = 0;
  for (const doc of docs) {
    if (budgetExceeded(startedAt)) break;
    for (const photo of doc.photos) {
      if (!isCloudinaryUrl(photo.photoUrl)) continue;
      if (budgetExceeded(startedAt)) break;
      try {
        photo.photoUrl = await archiveOneUrl(photo.photoUrl);
      } catch (err) {
        console.error("[archive] PatrolSubmission photo failed", doc._id.toString(), err.message);
      }
    }
    await doc.save();
    processed++;
  }
  return processed;
}

async function archiveNightGuardSubmissions(cutoff, startedAt) {
  const docs = await NightGuardSubmission.find({
    submittedAt: { $lt: cutoff },
    guardPhotoUrl: { $regex: "res\\.cloudinary\\.com" },
  }).limit(BATCH_LIMIT);

  let processed = 0;
  for (const doc of docs) {
    if (budgetExceeded(startedAt)) break;
    try {
      doc.guardPhotoUrl = await archiveOneUrl(doc.guardPhotoUrl);
      await doc.save();
    } catch (err) {
      console.error("[archive] NightGuardSubmission failed", doc._id.toString(), err.message);
    }
    processed++;
  }
  return processed;
}

async function archiveAttendanceScans(cutoff, startedAt) {
  const docs = await AttendanceScan.find({
    timestamp: { $lt: cutoff },
    photo: { $regex: "res\\.cloudinary\\.com" },
  }).limit(BATCH_LIMIT);

  let processed = 0;
  for (const doc of docs) {
    if (budgetExceeded(startedAt)) break;
    try {
      doc.photo = await archiveOneUrl(doc.photo);
      await doc.save();
    } catch (err) {
      console.error("[archive] AttendanceScan failed", doc._id.toString(), err.message);
    }
    processed++;
  }
  return processed;
}

async function archiveGCHousekeepingSubmissions(cutoff, startedAt) {
  const docs = await GCHousekeepingSubmission.find({
    submittedAt: { $lt: cutoff },
    "photos.photoUrl": { $regex: "res\\.cloudinary\\.com" },
  }).limit(BATCH_LIMIT);

  let processed = 0;
  for (const doc of docs) {
    if (budgetExceeded(startedAt)) break;
    for (const photo of doc.photos) {
      if (!isCloudinaryUrl(photo.photoUrl)) continue;
      if (budgetExceeded(startedAt)) break;
      try {
        photo.photoUrl = await archiveOneUrl(photo.photoUrl);
      } catch (err) {
        console.error("[archive] GCHousekeepingSubmission photo failed", doc._id.toString(), err.message);
      }
    }
    await doc.save();
    processed++;
  }
  return processed;
}

async function archiveFireMockDrills(cutoff, startedAt) {
  // date is a "YYYY-MM-DD" string, not a real Date field, so compare as
  // strings — works fine since ISO-formatted dates sort lexicographically.
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  const docs = await FireMockDrill.find({ date: { $lt: cutoffKey } }).limit(BATCH_LIMIT);

  let processed = 0;
  for (const doc of docs) {
    if (budgetExceeded(startedAt)) break;
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
    processed++;
  }
  return processed;
}

async function archiveOldMedia() {
  if (!isConfigured()) return;
  const cutoff = new Date(Date.now() - ARCHIVE_AFTER_DAYS * 24 * 60 * 60 * 1000);
  const startedAt = Date.now();

  const counts = {};
  const steps = [
    ["patrol", archivePatrolSubmissions],
    ["nightGuard", archiveNightGuardSubmissions],
    ["attendance", archiveAttendanceScans],
    ["fireMockDrill", archiveFireMockDrills],
    ["gcHousekeeping", archiveGCHousekeepingSubmissions],
  ];
  for (const [key, fn] of steps) {
    if (budgetExceeded(startedAt)) {
      counts[key] = 0;
      continue;
    }
    counts[key] = await fn(cutoff, startedAt);
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total > 0) console.log("[archive] processed", counts);
}

module.exports = { archiveOldMedia };
