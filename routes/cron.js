const express = require("express");
const router = express.Router();
const { checkCloudinaryUsageAndAlert } = require("../utils/cloudinaryUsageAlert");
const { archiveOldMedia } = require("../utils/archiveOldMedia");
const { runDailyBackup } = require("../utils/dailyBackup");

function checkSecret(req, res) {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ message: "Unauthorized" });
    return false;
  }
  return true;
}

// On a long-running host these ran on a setInterval; a serverless function
// has no persistent process to hold one, so Vercel Cron hits this once a
// day instead. Vercel automatically sends `Authorization: Bearer
// $CRON_SECRET` on cron-triggered requests when a CRON_SECRET env var is
// set, so this only has to compare against that.
//
// IMPORTANT: any path listed in vercel.json's `crons` array — this one
// included — gets silently blocked by Vercel for anyone but its own cron
// scheduler, even with the correct CRON_SECRET; an external caller (a
// hosted scheduler, a manual curl) just hangs with no response at all.
// That's exactly why /archive-media below is a *separate*, unlisted path.
router.get("/daily-tasks", async (req, res) => {
  if (!checkSecret(req, res)) return;

  const results = await Promise.allSettled([checkCloudinaryUsageAndAlert(), archiveOldMedia(), runDailyBackup()]);
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`[cron] task ${i} failed`, r.reason);
    }
  });

  res.json({ ok: true });
});

// Same archival work as above, on its own reachable-from-anywhere path —
// deliberately not in vercel.json's `crons` list (see note above) — so an
// external scheduler (e.g. cron-job.org) can trigger it far more often
// than Vercel's own once-a-day cron allows on the Hobby plan, which
// matters once daily photo volume outgrows what one run a day can drain.
router.get("/archive-media", async (req, res) => {
  if (!checkSecret(req, res)) return;

  try {
    await archiveOldMedia();
    res.json({ ok: true });
  } catch (err) {
    console.error("[cron] archive-media failed", err.message);
    res.status(500).json({ ok: false, message: err.message });
  }
});

module.exports = router;
