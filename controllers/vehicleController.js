const VehicleRide = require("../models/VehicleRide");

const VEHICLES = ["TATA EV", "Honda City"];

exports.meta = async (req, res) => {
  res.json({ vehicles: VEHICLES });
};

exports.createSubmission = async (req, res) => {
  const { vehicleName, date, startReading, endReading, personName } = req.body;
  if (!vehicleName || !date || startReading === undefined || endReading === undefined || !personName) {
    return res.status(400).json({ message: "vehicleName, date, startReading, endReading and personName are required" });
  }
  if (!VEHICLES.includes(vehicleName)) {
    return res.status(400).json({ message: "Invalid vehicleName" });
  }
  const start = Number(startReading);
  const end = Number(endReading);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return res.status(400).json({ message: "Ending Meter Reading must be greater than or equal to Start Meter Reading" });
  }

  const ride = await VehicleRide.create({ vehicleName, date, startReading: start, endReading: end, personName });
  res.status(201).json(ride);
};

exports.listSubmissions = async (req, res) => {
  const { vehicleName, date } = req.query;
  const filter = {};
  if (vehicleName) filter.vehicleName = vehicleName;
  if (date) filter.date = date;

  const rides = await VehicleRide.find(filter).sort({ date: -1, createdAt: -1 });
  res.json(
    rides.map((r) => ({
      _id: r._id,
      vehicleName: r.vehicleName,
      date: r.date,
      startReading: r.startReading,
      endReading: r.endReading,
      distance: r.endReading - r.startReading,
      personName: r.personName,
      createdAt: r.createdAt,
    }))
  );
};

exports.updateSubmission = async (req, res) => {
  const { vehicleName, date, startReading, endReading, personName } = req.body;
  if (!vehicleName || !date || startReading === undefined || endReading === undefined || !personName) {
    return res.status(400).json({ message: "vehicleName, date, startReading, endReading and personName are required" });
  }
  if (!VEHICLES.includes(vehicleName)) {
    return res.status(400).json({ message: "Invalid vehicleName" });
  }
  const start = Number(startReading);
  const end = Number(endReading);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return res.status(400).json({ message: "Ending Meter Reading must be greater than or equal to Start Meter Reading" });
  }

  const ride = await VehicleRide.findByIdAndUpdate(
    req.params.id,
    { vehicleName, date, startReading: start, endReading: end, personName },
    { new: true }
  );
  if (!ride) return res.status(404).json({ message: "Ride not found" });
  res.json(ride);
};

exports.deleteSubmission = async (req, res) => {
  const ride = await VehicleRide.findByIdAndDelete(req.params.id);
  if (!ride) return res.status(404).json({ message: "Ride not found" });
  res.json({ message: "Ride deleted" });
};

// One row per vehicle+date, summing that day's individual ride distances —
// a vehicle can have more than one ride logged on the same day, and the
// Daily Report's whole point is the day's total km, not any single ride's.
exports.dailyReport = async (req, res) => {
  const { vehicleName, date } = req.query;
  const filter = {};
  if (vehicleName) filter.vehicleName = vehicleName;
  if (date) filter.date = date;

  const rides = await VehicleRide.find(filter);
  const byKey = new Map();
  rides.forEach((r) => {
    const key = `${r.vehicleName}__${r.date}`;
    const distance = r.endReading - r.startReading;
    if (!byKey.has(key)) byKey.set(key, { vehicleName: r.vehicleName, date: r.date, totalDistance: 0, rideCount: 0 });
    const entry = byKey.get(key);
    entry.totalDistance += distance;
    entry.rideCount += 1;
  });

  const rows = [...byKey.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.vehicleName.localeCompare(b.vehicleName)));
  res.json(rows);
};
