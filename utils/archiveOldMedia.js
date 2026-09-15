const { cloudinary, CLOUDINARY_ACCOUNTS } = require("../middleware/upload");
const { uploadToDrive, isConfigured } = require("./googleDrive");
const PatrolSubmission = require("../models/PatrolSubmission");
const NightGuardSubmission = require("../models/NightGuardSubmission");
const AttendanceScan = require("../models/AttendanceScan");
const FireMockDrill = require("../models/FireMockDrill");
const GCHousekeepingSubmission = require("../models/GCHousekeepingSubmission");
const GCClubSubmission = require("../models/GCClubSubmission");
const ReserveClubSubmission = require("../models/ReserveClubSubmission");
const RegalGardenClubSubmission = require("../models/RegalGardenClubSubmission");

// Files older than this move from Cloudinary to Google Drive to free up
// Cloudinary storage, while everything recent stays on Cloudinary (fast CDN,
// no dependency on the Drive account being reachable). The app keeps
// working exactly the same either way — only the URL stored in Mongo
// changes; the field itself is untouched.
const ARCHIVE_AFTER_DAYS = 2;
// A single Mongo query per model, so one huge backlog can't fetch
// unbounded documents before the time/concurrency limits below even get a
// chance to run.
const BATCH_LIMIT = 40;
// Each archived file costs 2 network round trips (Cloudinary download +
// Drive upload) that spend almost all their time waiting on I/O, not CPU —
// running several at once overlaps those waits instead of paying for them
// one at a time, multiplying how much fits in the time budget below.
const CONCURRENCY = 6;
// This runs inside a Vercel serverless invocation (60s ceiling — see
// routes/cron.js), not a long-lived process, so it has to stop itself well
// before that ceiling rather than run until killed mid-file. Leaves a
// backlog to drain a bit more each run rather than trying to force it all
// through at once. Kept with real margin below 60s: even in the worst
// case, a task already in flight when the budget check fires can still
// run up to its own network timeouts (see archiveOneUrl) before this
// function actually returns — 30s budget + ~25s worst-case single-file
// timeout chain stays safely under the 60s ceiling.
const TIME_BUDGET_MS = 30000;

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

// A stalled network call used to be able to hang indefinitely — inside the
// concurrency pool below, that meant one stuck file blocked its whole
// worker (and eventually the whole batch) well past TIME_BUDGET_MS, all
// the way to Vercel's hard 60s function timeout, since the budget check
// only runs *between* tasks, not during one. Racing every network call
// against a timeout is what actually makes that budget check meaningful.
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

// Downloads one Cloudinary file, re-uploads it to Drive, deletes the
// Cloudinary copy, and returns the new URL. Best-effort per file — if this
// throws, the caller should leave that field untouched and try again next
// run rather than lose the reference.
async function archiveOneUrl(url) {
  const parsed = parseCloudinaryUrl(url);
  if (!parsed) return url;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  let res;
  try {
    res = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const mimeType = res.headers.get("content-type") || "application/octet-stream";
  const filename = parsed.publicId.split("/").pop();

  const { url: newUrl } = await withTimeout(uploadToDrive({ buffer, filename, mimeType }), 12000, "Drive upload");
  await withTimeout(
    cloudinary.uploader.destroy(parsed.publicId, { resource_type: parsed.resourceType, ...authForCloudName(parsed.cloudName) }),
    5000,
    "Cloudinary destroy"
  ).catch(() => {});
  return newUrl;
}

// Every model below builds a flat list of { label, docId, touchedDocs, run }
// tasks rather than archiving as it goes — that's what lets archiveOldMedia
// interleave them round-robin (see below) so one large model's backlog
// can't starve the others out of the shared time budget, and what lets a
// concurrency pool work each one down.

function photosArrayTasks(docs, label, touchedDocs) {
  const tasks = [];
  for (const doc of docs) {
    for (const photo of doc.photos) {
      if (!isCloudinaryUrl(photo.photoUrl)) continue;
      tasks.push({
        label,
        docId: doc._id.toString(),
        run: async () => {
          photo.photoUrl = await archiveOneUrl(photo.photoUrl);
          touchedDocs.add(doc);
        },
      });
    }
  }
  return tasks;
}

function singleFieldTasks(docs, fieldName, label, touchedDocs) {
  const tasks = [];
  for (const doc of docs) {
    if (!isCloudinaryUrl(doc[fieldName])) continue;
    tasks.push({
      label,
      docId: doc._id.toString(),
      run: async () => {
        doc[fieldName] = await archiveOneUrl(doc[fieldName]);
        touchedDocs.add(doc);
      },
    });
  }
  return tasks;
}

function fireMockDrillTasks(docs, touchedDocs) {
  const tasks = [];
  for (const doc of docs) {
    if (isCloudinaryUrl(doc.panelPhoto)) {
      tasks.push({
        label: "fireMockDrill",
        docId: doc._id.toString(),
        run: async () => {
          doc.panelPhoto = await archiveOneUrl(doc.panelPhoto);
          touchedDocs.add(doc);
        },
      });
    }
    if (isCloudinaryUrl(doc.reportAttachment)) {
      tasks.push({
        label: "fireMockDrill",
        docId: doc._id.toString(),
        run: async () => {
          doc.reportAttachment = await archiveOneUrl(doc.reportAttachment);
          touchedDocs.add(doc);
        },
      });
    }
    doc.checklistAttachments.forEach((url, i) => {
      if (!isCloudinaryUrl(url)) return;
      tasks.push({
        label: "fireMockDrill",
        docId: doc._id.toString(),
        run: async () => {
          doc.checklistAttachments[i] = await archiveOneUrl(url);
          touchedDocs.add(doc);
        },
      });
    });
    // Videos are left on Cloudinary for now — they can be large enough
    // that buffering the whole file in memory to re-upload isn't safe
    // without streaming support, which this doesn't implement yet.
  }
  return tasks;
}

// Interleaves each model's task list round-robin (one from model A, one
// from B, ... back to A) instead of concatenating them — so if the time
// budget runs out partway through, every model already got a fair turn
// rather than the first, largest backlog eating the whole run.
function interleave(lists) {
  const merged = [];
  const maxLen = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < maxLen; i++) {
    for (const list of lists) {
      if (list[i]) merged.push(list[i]);
    }
  }
  return merged;
}

// A fixed pool of workers each pull the next task off the shared queue —
// standard bounded-concurrency pattern — until the queue's drained or the
// wall-clock budget's spent, whichever comes first.
async function runPool(tasks, startedAt) {
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < tasks.length && !budgetExceeded(startedAt)) {
      const task = tasks[nextIndex++];
      try {
        await task.run();
      } catch (err) {
        console.error(`[archive] ${task.label} failed`, task.docId, err.message);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return nextIndex;
}

async function archiveOldMedia() {
  if (!isConfigured()) return;
  const cutoff = new Date(Date.now() - ARCHIVE_AFTER_DAYS * 24 * 60 * 60 * 1000);
  const cutoffKey = cutoff.toISOString().slice(0, 10); // FireMockDrill's date is a "YYYY-MM-DD" string
  const startedAt = Date.now();

  const [patrolDocs, nightGuardDocs, attendanceDocs, fireMockDrillDocs, gcHousekeepingDocs, gcClubDocs, reserveClubDocs, regalGardenClubDocs] =
    await Promise.all([
      PatrolSubmission.find({ submittedAt: { $lt: cutoff }, "photos.photoUrl": { $regex: "res\\.cloudinary\\.com" } }).limit(
        BATCH_LIMIT
      ),
      NightGuardSubmission.find({ submittedAt: { $lt: cutoff }, guardPhotoUrl: { $regex: "res\\.cloudinary\\.com" } }).limit(
        BATCH_LIMIT
      ),
      AttendanceScan.find({ timestamp: { $lt: cutoff }, photo: { $regex: "res\\.cloudinary\\.com" } }).limit(BATCH_LIMIT),
      FireMockDrill.find({ date: { $lt: cutoffKey } }).limit(BATCH_LIMIT),
      GCHousekeepingSubmission.find({
        submittedAt: { $lt: cutoff },
        "photos.photoUrl": { $regex: "res\\.cloudinary\\.com" },
      }).limit(BATCH_LIMIT),
      GCClubSubmission.find({ submittedAt: { $lt: cutoff }, "photos.photoUrl": { $regex: "res\\.cloudinary\\.com" } }).limit(
        BATCH_LIMIT
      ),
      ReserveClubSubmission.find({
        submittedAt: { $lt: cutoff },
        "photos.photoUrl": { $regex: "res\\.cloudinary\\.com" },
      }).limit(BATCH_LIMIT),
      RegalGardenClubSubmission.find({
        submittedAt: { $lt: cutoff },
        "photos.photoUrl": { $regex: "res\\.cloudinary\\.com" },
      }).limit(BATCH_LIMIT),
    ]);

  const touchedDocs = new Set();
  const taskLists = [
    photosArrayTasks(patrolDocs, "patrol", touchedDocs),
    singleFieldTasks(nightGuardDocs, "guardPhotoUrl", "nightGuard", touchedDocs),
    singleFieldTasks(attendanceDocs, "photo", "attendance", touchedDocs),
    fireMockDrillTasks(fireMockDrillDocs, touchedDocs),
    photosArrayTasks(gcHousekeepingDocs, "gcHousekeeping", touchedDocs),
    photosArrayTasks(gcClubDocs, "gcClub", touchedDocs),
    photosArrayTasks(reserveClubDocs, "reserveClub", touchedDocs),
    photosArrayTasks(regalGardenClubDocs, "regalGardenClub", touchedDocs),
  ];

  const tasks = interleave(taskLists);
  const attempted = await runPool(tasks, startedAt);

  await Promise.all([...touchedDocs].map((doc) => doc.save()));

  if (attempted > 0) {
    console.log(
      `[archive] attempted ${attempted}/${tasks.length} eligible files, touched ${touchedDocs.size} documents`
    );
  }
}

module.exports = { archiveOldMedia };
