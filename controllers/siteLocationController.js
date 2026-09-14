const SiteLocation = require("../models/SiteLocation");
const MaintenanceStaff = require("../models/MaintenanceStaff");

exports.list = async (req, res) => {
  const [sites, locations] = await Promise.all([MaintenanceStaff.distinct("siteName"), SiteLocation.find()]);
  const bySite = new Map(locations.map((l) => [l.siteName, l]));

  const merged = sites.sort().map((siteName) => {
    const loc = bySite.get(siteName);
    return {
      siteName,
      latitude: loc ? loc.latitude : null,
      longitude: loc ? loc.longitude : null,
      radiusMeters: loc ? loc.radiusMeters : 500,
      configured: !!loc,
      enabled: loc ? loc.enabled !== false : false,
    };
  });

  res.json(merged);
};

exports.upsert = async (req, res) => {
  const { siteName } = req.params;
  const { latitude, longitude, radiusMeters } = req.body;
  const loc = await SiteLocation.findOneAndUpdate(
    { siteName },
    { siteName, latitude, longitude, radiusMeters: radiusMeters || 500 },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  res.json(loc);
};

exports.remove = async (req, res) => {
  await SiteLocation.findOneAndDelete({ siteName: req.params.siteName });
  res.json({ message: "Site location removed" });
};

// Pauses/resumes geofence enforcement without touching the saved
// latitude/longitude/radius — re-enabling restores the exact same location.
exports.setEnabled = async (req, res) => {
  const { siteName } = req.params;
  const { enabled } = req.body;
  const loc = await SiteLocation.findOneAndUpdate({ siteName }, { enabled: !!enabled }, { new: true });
  if (!loc) return res.status(404).json({ message: "Is site ka location abhi set nahi hai" });
  res.json(loc);
};
