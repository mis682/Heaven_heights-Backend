// Fire-and-forget webhook POST to an n8n workflow (Webhook trigger node).
// n8n being unreachable or unconfigured must never block or fail a real
// submission — the caller never awaits this. envKey lets a caller target a
// different n8n workflow (e.g. attendance has its own dedicated webhook,
// separate from the shared one used for Patrol/Night Guard).
async function notifyWebhook(payload, envKey = "N8N_WEBHOOK_URL") {
  const webhookUrl = process.env[envKey];
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
