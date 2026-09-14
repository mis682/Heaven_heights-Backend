const PERMISSION_MODULES = [
  { key: "attendance", label: "Attendance" },
  { key: "patrol", label: "Security Patrol" },
  { key: "nightGuard", label: "Night Guard" },
  { key: "fireMockDrill", label: "Fire Mock Drill" },
  { key: "gcHousekeeping", label: "Garden City Housekeeping" },
  { key: "gcClub", label: "Garden City Club" },
  { key: "reserveClub", label: "Neoteric Reserve Club" },
  { key: "regalGardenClub", label: "Regal Garden Club" },
  { key: "maintenanceStaff", label: "Maintenance Staff" },
  { key: "guards", label: "Guard Master Data" },
  { key: "projects", label: "Projects" },
  { key: "siteLocations", label: "Site Locations" },
  { key: "media", label: "Media" },
  { key: "users", label: "User Management" },
];

function emptyPermissions() {
  const perms = {};
  for (const m of PERMISSION_MODULES) perms[m.key] = { view: false, edit: false, delete: false };
  return perms;
}

function sanitizePermissions(input = {}) {
  const result = {};
  for (const m of PERMISSION_MODULES) {
    const entry = input[m.key] || {};
    result[m.key] = { view: !!entry.view, edit: !!entry.edit, delete: !!entry.delete };
  }
  return result;
}

module.exports = { PERMISSION_MODULES, emptyPermissions, sanitizePermissions };
