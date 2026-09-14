// Sends via Resend's HTTPS API rather than raw SMTP — Render (like most
// PaaS hosts) blocks outbound SMTP ports to prevent spam abuse, so a direct
// Gmail/SMTP connection just hangs until it times out. An HTTPS API call
// has no such restriction.
const RESEND_API_URL = "https://api.resend.com/emails";

// Best-effort — a missing/broken mail config should never crash whatever
// triggered the alert, it should just skip sending (same fire-and-forget
// philosophy as the Slack/n8n webhook).
async function sendAlertEmail({ subject, html, text, attachments }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  try {
    await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "Heaven Heights Alerts <onboarding@resend.dev>",
        to: [process.env.ALERT_EMAIL_TO || "mis@neotericgrp.in"],
        subject,
        text,
        html,
        // Resend expects each attachment's content as a base64 string.
        attachments: attachments?.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })),
      }),
    });
  } catch {
    /* ignore — email delivery is best-effort */
  }
}

module.exports = { sendAlertEmail };
