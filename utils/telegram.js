// Fire-and-forget notification via the Telegram Bot API. Missing/broken
// config must never crash whatever triggered it — same philosophy as the
// Slack/n8n webhook and the email alerts.
const CAPTION_LIMIT = 1024;

function apiUrl(method) {
  return `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;
}

async function sendTelegramMessage({ text, photoUrl }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  try {
    if (photoUrl && text.length <= CAPTION_LIMIT) {
      // Fits as a single photo-with-caption message. Plain text (no
      // parse_mode) — our captions embed raw URLs, and Telegram's Markdown
      // mode fails the whole send on any unescaped "_"/"*"/etc., which URLs
      // routinely contain.
      await fetch(apiUrl("sendPhoto"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption: text }),
      });
      return;
    }

    if (text) {
      await fetch(apiUrl("sendMessage"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
    }
    if (photoUrl) {
      await fetch(apiUrl("sendPhoto"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, photo: photoUrl }),
      });
    }
  } catch {
    /* ignore — Telegram delivery is best-effort */
  }
}

module.exports = { sendTelegramMessage };
