// Fire Mock Drill's Daily Report checks over existing submission evidence
// (panel photo, videos, checklist pages) rather than cleanliness, so OK/Not
// OK leads instead of Clean/Not Clean — plus the usual remark values for
// when a checkpoint wasn't actually submitted/assessable.
const FIRE_MOCK_DRILL_STATUS_OPTIONS = [
  "OK",
  "Not OK",
  "NA",
  "Form not fill",
  "Holiday",
  "Leave",
  "Week off",
  "Absent",
  "Timestamp Missing",
  "Blur video",
  "Blur image",
];

module.exports = { FIRE_MOCK_DRILL_STATUS_OPTIONS };
