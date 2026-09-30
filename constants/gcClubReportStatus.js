// Garden City Club's own status vocabulary — separate from Garden City
// Housekeeping's (different wording/options), matching the coordinator's
// existing dropdown for this checklist.
const GC_CLUB_STATUS_OPTIONS = [
  "Clean",
  "Not Clean",
  "Blur Image",
  "Timestamp missing",
  "Form not fill",
  "Holiday",
  "Image Missing",
  "Same image",
];

// Neoteric Reserve Club and Regal Garden Club share GC Club's vocabulary
// plus extra statuses those two need that GC Club's own dropdown doesn't
// have — "NA" (checkpoint doesn't apply that day), "Guest" (room occupied
// by a guest, so it can't be serviced/checked), "Week off" and "Leave"
// (the assigned staff wasn't on duty that day).
const RESERVE_REGAL_CLUB_STATUS_OPTIONS = [...GC_CLUB_STATUS_OPTIONS, "NA", "Guest", "Week off", "Leave"];

module.exports = { GC_CLUB_STATUS_OPTIONS, RESERVE_REGAL_CLUB_STATUS_OPTIONS };
