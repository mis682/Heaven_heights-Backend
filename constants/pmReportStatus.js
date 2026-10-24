const { RESERVE_REGAL_CLUB_STATUS_OPTIONS } = require("./gcClubReportStatus");

// Property Management's own status vocabulary — same base as Reserve Club /
// Regal Garden Club / (Housekeeping) Regal Garden, Eden Garden, Neo
// Meridian, Head Office, plus "Under Construction" (a unit not yet ready to
// be photographed/assessed), which only makes sense for PM's unit-by-unit
// reports, not the other modules' fixed checkpoints.
const PM_STATUS_OPTIONS = [...RESERVE_REGAL_CLUB_STATUS_OPTIONS, "Under Construction"];

module.exports = { PM_STATUS_OPTIONS };
