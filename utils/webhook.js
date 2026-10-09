// Fire-and-forget webhook POST to an n8n workflow (Webhook trigger node).
// n8n being unreachable or unconfigured must never block or fail a real
// submission — the caller never awaits this. envKey lets a caller target a
// different n8n workflow (e.g. attendance has its own dedicated webhook,
// separate from the shared one used for Patrol/Night Guard).
async function notifyWebhook(payload, envKey = "N8N_WEBHOOK_URL") {
  // .trim() guards against a stray trailing newline/space in the env var's
  // value (e.g. pasted into a dashboard with an extra line) — fetch() treats
  // such a URL as invalid and the call silently fails otherwise.
  const webhookUrl = process.env[envKey]?.trim();
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    /* ignore — webhook delivery is best-effort */
  }
}

module.exports = { notifyWebhook };
