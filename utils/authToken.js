const crypto = require("crypto");

const SECRET = process.env.AUTH_SECRET || "heaven-heights-dev-secret";
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verify(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [body, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  if (signature !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = { sign, verify, TOKEN_TTL_MS };
