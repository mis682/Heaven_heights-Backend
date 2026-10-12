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
  "GST",
  "Hyde Park",
  "Milestone",
  "Neo Meridian",
  "Regal Garden Club",
];

// The Daily Report is split across two coordinators, each responsible for a
// fixed set of sites — a coordinator picks their own named report instead of
// seeing every site's staff at once. Keyed by report name so the Daily
// Report page's dropdown options are these exact keys.
const MAINTENANCE_UNIFORM_REPORT_FORMATS = {
  "Priyanka Report": ["One Business Center", "Garden City", "Garden City Club", "Nature Park"],
  "Niketa Report": ["Milestone", "Regal Garden", "GST", "Neo Meridian", "Neoteric Reserve", "Hyde Park", "Regal Garden Club"],
};

module.exports = {
  MAINTENANCE_UNIFORM_STATUS_OPTIONS,
  MAINTENANCE_UNIFORM_DESIGNATIONS,
  MAINTENANCE_UNIFORM_SITES,
  MAINTENANCE_UNIFORM_REPORT_FORMATS,
};
