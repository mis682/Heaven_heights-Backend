// Maintenance Uniform daily-report status vocabulary — matches the
// coordinator's existing dropdown for this checklist.
const MAINTENANCE_UNIFORM_STATUS_OPTIONS = [
  "OK",
  "Not OK",
  "Blur Image",
  "Timestamp missing",
  "Absent",
  "Same image",
  "missing image",
  "holiday",
];

// Daily Report groups staff by designation in this fixed order (Security
// Guard first, then House Keeping, then Gardener) regardless of how many
// staff are in each group or what order MaintenanceStaff happens to return
// them in.
const MAINTENANCE_UNIFORM_DESIGNATIONS = ["Security Guard", "House Keeping", "Gardener"];

// Fixed site list for the public submission form — intentionally not every
// site in the system, just the ones this checklist covers.
const MAINTENANCE_UNIFORM_SITES = [
  "Garden City",
  "Regal Garden",
  "Nature Park",
  "One Business Center",
  "Neoteric Reserve",
  "Garden City Club",
];

module.exports = { MAINTENANCE_UNIFORM_STATUS_OPTIONS, MAINTENANCE_UNIFORM_DESIGNATIONS, MAINTENANCE_UNIFORM_SITES };
