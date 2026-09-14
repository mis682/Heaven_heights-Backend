const { verify } = require("../utils/authToken");
const { computeFingerprint } = require("../utils/userFingerprint");
const User = require("../models/User");

// Re-fetches the user on every request (rather than trusting the token's
// own claims) so a just-deactivated or just-edited account is blocked
// immediately, not just at the client's next 60s /verify poll.
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const payload = token && verify(token);
  if (!payload) return res.status(401).json({ message: "Not authenticated" });

  const user = await User.findById(payload.userId).select("+passwordHash");
  if (!user || !user.active) return res.status(401).json({ message: "Not authenticated" });

  if (computeFingerprint(user) !== payload.fingerprint) {
    return res.status(401).json({ message: "Session expired — please log in again" });
  }

  req.user = user;
  next();
}

function requirePermission(moduleKey, action) {
  return (req, res, next) => {
    if (req.user.role === "Admin") return next();
    if (!req.user.permissions?.[moduleKey]?.[action]) {
      return res.status(403).json({ message: "You don't have permission to do this" });
    }
    next();
  };
}

module.exports = { requireAuth, requirePermission };
