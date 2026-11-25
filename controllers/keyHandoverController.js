const KeyHandover = require("../models/KeyHandover");

const VEHICLES = ["Car", "EV"];
const DRIVERS = ["Neeraj", "Manoj", "Dharmendra"];

exports.meta = async (req, res) => {
  res.json({ vehicles: VEHICLES, drivers: DRIVERS });
};

exports.create = async (req, res) => {
  const { vehicle, date, driverName, inTime } = req.body;
  if (!vehicle || !date || !driverName || !inTime) {
    return res.status(400).json({ message: "vehicle, date, driverName and inTime are required" });
  }
  if (!VEHICLES.includes(vehicle)) return res.status(400).json({ message: "Invalid vehicle" });
  if (!DRIVERS.includes(driverName)) return res.status(400).json({ message: "Invalid driverName" });

  const entry = await KeyHandover.create({ vehicle, date, driverName, inTime });
  res.status(201).json(entry);
};

exports.list = async (req, res) => {
  const entries = await KeyHandover.find({}).sort({ createdAt: -1 }).limit(1000);
  res.json(entries);
};

// Coordinator fills this in later, once the key is actually handed back —
// the only field editable after creation via the quick inline picker.
exports.setOutTime = async (req, res) => {
  const { id } = req.params;
  const { outTime } = req.body;
  if (outTime === undefined) return res.status(400).json({ message: "outTime is required" });

  const entry = await KeyHandover.findByIdAndUpdate(id, { outTime }, { new: true });
  if (!entry) return res.status(404).json({ message: "Entry not found" });
  res.json(entry);
};

const EDITABLE_FIELDS = ["vehicle", "date", "driverName", "inTime", "outTime"];

exports.update = async (req, res) => {
  const { id } = req.params;
  const update = {};
  EDITABLE_FIELDS.forEach((f) => {
    if (req.body[f] !== undefined) update[f] = req.body[f];
  });

  const entry = await KeyHandover.findByIdAndUpdate(id, update, { new: true, runValidators: true });
  if (!entry) return res.status(404).json({ message: "Entry not found" });
  res.json(entry);
};

exports.remove = async (req, res) => {
  const entry = await KeyHandover.findByIdAndDelete(req.params.id);
  if (!entry) return res.status(404).json({ message: "Entry not found" });
  res.json({ message: "Deleted" });
};
