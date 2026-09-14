const { cloudinary, CLOUDINARY_ACCOUNTS } = require("../middleware/upload");
const CloudinaryAlertState = require("../models/CloudinaryAlertState");
const { sendAlertEmail } = require("./mailer");

// Alert once when usage first climbs past each of these percentages of the
// plan's credit limit, not on every check — re-armed if usage ever drops
// back below the last-alerted threshold (e.g. Cloudinary's monthly
// bandwidth/transformation reset).
const THRESHOLDS = [50, 75, 90];

// Above this, new uploads fail over to the next account in
// CLOUDINARY_ACCOUNTS rather than risk Cloudinary rejecting them outright
// once the active account's credits run out.
const FALLBACK_THRESHOLD = 90;

function toMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1);
}

async function getUsage(account) {
  try {
    return await cloudinary.api.usage({
      cloud_name: account.cloud_name,
      api_key: account.api_key,
      api_secret: account.api_secret,
    });
  } catch {
    return null; // transient Cloudinary API hiccup — try again next cycle
  }
}

async function checkCloudinaryUsageAndAlert() {
  const primary = CLOUDINARY_ACCOUNTS[0];
  const primaryUsage = await getUsage(primary);
  if (!primaryUsage) return;

  const usedPercent = primaryUsage.credits?.used_percent ?? 0;

  let state = await CloudinaryAlertState.findOne();
  if (!state) state = await CloudinaryAlertState.create({});

  if (usedPercent < state.lastAlertedThreshold) {
    state.lastAlertedThreshold = 0; // usage dropped — re-arm thresholds
  }

  const nextThreshold = [...THRESHOLDS].reverse().find((t) => usedPercent >= t && t > state.lastAlertedThreshold);

  state.lastUsedPercent = usedPercent;

  if (nextThreshold) {
    state.lastAlertedThreshold = nextThreshold;
    state.lastAlertedAt = new Date();

    const storageMB = toMB(primaryUsage.storage?.usage ?? 0);
    const bandwidthMB = toMB(primaryUsage.bandwidth?.usage ?? 0);
    const transformations = primaryUsage.transformations?.usage ?? 0;
    const creditsUsed = primaryUsage.credits?.usage ?? 0;
    const creditsLimit = primaryUsage.credits?.limit ?? 25;

    await sendAlertEmail({
      subject: `Cloudinary usage at ${nextThreshold}% — Heaven Heights`,
      text:
        `Cloudinary plan usage has crossed ${nextThreshold}%.\n\n` +
        `Credits used: ${creditsUsed} / ${creditsLimit} (${usedPercent}%)\n` +
        `Storage: ${storageMB} MB\n` +
        `Bandwidth (this cycle): ${bandwidthMB} MB\n` +
        `Transformations (this cycle): ${transformations}\n\n` +
        `If this keeps climbing, guard checkpoint photo uploads could start failing once the free plan limit is hit.`,
      html:
        `<p>Cloudinary plan usage has crossed <b>${nextThreshold}%</b>.</p>` +
        `<ul>` +
        `<li>Credits used: <b>${creditsUsed} / ${creditsLimit}</b> (${usedPercent}%)</li>` +
        `<li>Storage: ${storageMB} MB</li>` +
        `<li>Bandwidth (this cycle): ${bandwidthMB} MB</li>` +
        `<li>Transformations (this cycle): ${transformations}</li>` +
        `</ul>` +
        `<p>If this keeps climbing, guard checkpoint photo uploads could start failing once the free plan limit is hit.</p>`,
    });
  }

  // Failover chain: advance a tier when the currently-active account's own
  // usage crosses the threshold, or jump straight back to Primary (tier 0)
  // as soon as ITS usage recovers (e.g. the monthly reset) — regardless of
  // which tier was active, since a Primary reset is the clearest signal a
  // new cycle has begun.
  const activeIndex = Math.min(state.activeAccountIndex || 0, CLOUDINARY_ACCOUNTS.length - 1);
  let newIndex = activeIndex;

  if (activeIndex > 0 && usedPercent < FALLBACK_THRESHOLD) {
    newIndex = 0;
  } else {
    const activeUsage = activeIndex === 0 ? primaryUsage : await getUsage(CLOUDINARY_ACCOUNTS[activeIndex]);
    const activeUsedPercent = activeUsage?.credits?.used_percent ?? 0;
    if (activeUsedPercent >= FALLBACK_THRESHOLD && activeIndex < CLOUDINARY_ACCOUNTS.length - 1) {
      newIndex = activeIndex + 1;
    }
  }

  if (newIndex !== activeIndex) {
    const fromLabel = CLOUDINARY_ACCOUNTS[activeIndex].label;
    const toLabel = CLOUDINARY_ACCOUNTS[newIndex].label;
    state.activeAccountIndex = newIndex;
    await sendAlertEmail({
      subject: `Cloudinary switched to "${toLabel}" account — Heaven Heights`,
      text:
        `New uploads (Attendance, Patrol, Night Guard, Fire Mock Drill, Maintenance Staff) have switched ` +
        `from the "${fromLabel}" account to the "${toLabel}" account.\n\n` +
        (newIndex > activeIndex
          ? `Reason: the "${fromLabel}" account's usage crossed the ${FALLBACK_THRESHOLD}% failover threshold.`
          : `Reason: the Primary account's usage dropped back below ${FALLBACK_THRESHOLD}% (likely the monthly reset).`),
      html:
        `<p>New uploads (Attendance, Patrol, Night Guard, Fire Mock Drill, Maintenance Staff) have switched ` +
        `from the <b>${fromLabel}</b> account to the <b>${toLabel}</b> account.</p>` +
        `<p>${
          newIndex > activeIndex
            ? `Reason: the "${fromLabel}" account's usage crossed the ${FALLBACK_THRESHOLD}% failover threshold.`
            : `Reason: the Primary account's usage dropped back below ${FALLBACK_THRESHOLD}% (likely the monthly reset).`
        }</p>`,
    });
  }

  await state.save();
}

module.exports = { checkCloudinaryUsageAndAlert };
