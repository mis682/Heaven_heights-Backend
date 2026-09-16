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
// plus two extra statuses those two need — "NA" (checkpoint doesn't apply
// that day) and "Guest" (room occupied by a guest, so it can't be
// serviced/checked) — that GC Club's own dropdown doesn't have.
const RESERVE_REGAL_CLUB_STATUS_OPTIONS = [...GC_CLUB_STATUS_OPTIONS, "NA", "Guest"];

module.exports = { GC_CLUB_STATUS_OPTIONS, RESERVE_REGAL_CLUB_STATUS_OPTIONS };
