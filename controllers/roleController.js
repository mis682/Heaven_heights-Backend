const Role = require("../models/Role");
const User = require("../models/User");
const { sanitizePermissions } = require("../constants/permissionModules");

exports.list = async (req, res) => {
  const roles = await Role.find().sort({ name: 1 });
  res.json(roles);
};

exports.create = async (req, res) => {
  const { name, permissions } = req.body;
  if (!name) return res.status(400).json({ message: "Role name is required" });
  const role = await Role.create({ name: name.trim(), permissions: sanitizePermissions(permissions) });
  res.status(201).json(role);
};

exports.update = async (req, res) => {
  const role = await Role.findById(req.params.id);
  if (!role) return res.status(404).json({ message: "Role not found" });
  if (role.isSystem) return res.status(400).json({ message: "The Admin role cannot be modified" });

  const { name, permissions } = req.body;
  if (name && name.trim() !== role.name) {
    const oldName = role.name;
    role.name = name.trim();
    await User.updateMany({ role: oldName }, { $set: { role: role.name } });
  }
  if (permissions) role.permissions = sanitizePermissions(permissions);
  await role.save();
  res.json(role);
};

exports.remove = async (req, res) => {
  const role = await Role.findById(req.params.id);
  if (!role) return res.status(404).json({ message: "Role not found" });
  if (role.isSystem) return res.status(400).json({ message: "The Admin role cannot be deleted" });

  const inUse = await User.countDocuments({ role: role.name });
  if (inUse > 0) {
    return res.status(400).json({ message: `Cannot delete: ${inUse} user(s) still have this role` });
  }

  await Role.findByIdAndDelete(req.params.id);
  res.json({ message: "Role deleted" });
};
