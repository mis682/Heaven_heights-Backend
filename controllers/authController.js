const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { sign, verify, TOKEN_TTL_MS } = require("../utils/authToken");
const { computeFingerprint } = require("../utils/userFingerprint");

exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+passwordHash");
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ message: "Incorrect email or password" });
  }

  const token = sign({
    userId: user._id.toString(),
    fingerprint: computeFingerprint(user),
    exp: Date.now() + TOKEN_TTL_MS,
  });

  res.json({ id: user._id, name: user.name, email: user.email, role: user.role, permissions: user.permissions, token });
};

// Lets an already-logged-in client notice its account was changed (password
// rotated, permissions/role edited, or deactivated) and force that session
// to log out, even though the token itself is still validly signed and
// unexpired — the fingerprint is recomputed from the current DB record.
exports.verify = async (req, res) => {
  const { token } = req.body;
  const payload = verify(token);
  if (!payload) return res.status(401).json({ ok: false, message: "Session expired — please log in again" });

  const user = await User.findById(payload.userId).select("+passwordHash");
  if (!user || !user.active || computeFingerprint(user) !== payload.fingerprint) {
    return res.status(401).json({ ok: false, message: "Session expired — please log in again" });
  }

  res.json({ ok: true });
};
