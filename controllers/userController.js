const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Role = require("../models/Role");
const { sanitizePermissions } = require("../constants/permissionModules");

function toSafeUser(user) {
  const obj = user.toObject ? user.toObject() : user;
  delete obj.passwordHash;
  return obj;
}

async function isLastActiveAdmin(userId) {
  const otherAdmins = await User.countDocuments({ role: "Admin", active: true, _id: { $ne: userId } });
  return otherAdmins === 0;
}

exports.list = async (req, res) => {
  const { role, active } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (active !== undefined) filter.active = active === "true";
  const users = await User.find(filter).sort({ name: 1 });
  res.json(users.map(toSafeUser));
};

exports.create = async (req, res) => {
  const { name, email, password, phone, employeeId, designation, department, role, permissions } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: "Name, email, password and role are required" });
  }

  const roleDoc = await Role.findOne({ name: role });
  if (!roleDoc) return res.status(400).json({ message: "Unknown role" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email,
    passwordHash,
    phone,
    employeeId,
    designation,
    department,
    role,
    permissions: sanitizePermissions(permissions || roleDoc.permissions || {}),
  });
  res.status(201).json(toSafeUser(user));
};

exports.update = async (req, res) => {
  const { password, permissions, role, active, ...rest } = req.body;
  const user = await User.findById(req.params.id).select("+passwordHash");
  if (!user) return res.status(404).json({ message: "User not found" });

  if (role && role !== user.role) {
    const roleDoc = await Role.findOne({ name: role });
    if (!roleDoc) return res.status(400).json({ message: "Unknown role" });
    if (user.role === "Admin" && (await isLastActiveAdmin(user._id))) {
      return res.status(400).json({ message: "Cannot change role: this is the last active Admin" });
    }
  }
  if (active === false && user.role === "Admin" && (await isLastActiveAdmin(user._id))) {
    return res.status(400).json({ message: "Cannot deactivate the last active Admin" });
  }

  Object.assign(user, rest);
  if (role) user.role = role;
  if (active !== undefined) user.active = active;
  if (permissions) user.permissions = sanitizePermissions(permissions);
  if (password) user.passwordHash = await bcrypt.hash(password, 10);

  await user.save();
  res.json(toSafeUser(user));
};

exports.remove = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });

  if (String(user._id) === String(req.user._id)) {
    return res.status(400).json({ message: "You cannot delete your own account" });
  }
  if (user.role === "Admin" && (await isLastActiveAdmin(user._id))) {
    return res.status(400).json({ message: "Cannot delete the last active Admin" });
  }

  await User.findByIdAndDelete(req.params.id);
  res.json({ message: "User deleted" });
};
