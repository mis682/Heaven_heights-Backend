const express = require("express");
const router = express.Router();
const { checkCloudinaryUsageAndAlert } = require("../utils/cloudinaryUsageAlert");
const { archiveOldMedia } = require("../utils/archiveOldMedia");
const { runDailyBackup } = require("../utils/dailyBackup");

// On a long-running host these ran on a setInterval; a serverless function
// has no persistent process to hold one, so Vercel Cron hits this once a
// day instead. Vercel automatically sends `Authorization: Bearer
// $CRON_SECRET` on cron-triggered requests when a CRON_SECRET env var is
// set, so this only has to compare against that.
router.get("/daily-tasks", async (req, res) => {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const results = await Promise.allSettled([checkCloudinaryUsageAndAlert(), archiveOldMedia(), runDailyBackup()]);
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`[cron] task ${i} failed`, r.reason);
    }
  });

  res.json({ ok: true });
});

module.exports = router;
