const { RESERVE_REGAL_CLUB_STATUS_OPTIONS } = require("./gcClubReportStatus");

// Head Office needed its own extra status ("Duplicate Image") that the
// other modules sharing RESERVE_REGAL_CLUB_STATUS_OPTIONS (Reserve Club,
// Regal Garden Club, Regal Garden, One Business Center, Nature Park, GC
// Club) don't use — kept as its own list instead of appending to the
// shared one so those other modules are unaffected. Appended at the end
// so index 0 ("Clean") still stays the "good" status everywhere that
// assumes it.
const HEAD_OFFICE_STATUS_OPTIONS = [...RESERVE_REGAL_CLUB_STATUS_OPTIONS, "Duplicate Image"];

module.exports = { HEAD_OFFICE_STATUS_OPTIONS };
