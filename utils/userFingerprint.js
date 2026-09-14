const crypto = require("crypto");

// Baked into the login token so a password change, permission edit, role
// change, or deactivation invalidates existing sessions on the next check —
// same idea as authController's old per-role pwFingerprint, now per-user.
function computeFingerprint(user) {
  return crypto
    .createHash("sha256")
    .update(`${user.passwordHash}|${JSON.stringify(user.permissions)}|${user.role}|${user.active}`)
    .digest("hex");
}

module.exports = { computeFingerprint };
