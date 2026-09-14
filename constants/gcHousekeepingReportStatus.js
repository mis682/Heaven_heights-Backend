// Matches the coordinator's existing spreadsheet dropdown exactly (including
// "Underconstraction", their spelling) so nothing looks unfamiliar when they
// switch from the manual sheet to this page.
const GC_HOUSEKEEPING_STATUS_OPTIONS = [
  "Cleaned",
  "Not Cleaned",
  "Blur Image",
  "Timestamp Missing",
  "Form not filled",
  "Image missing",
  "Underconstraction",
  "Holiday",
];

module.exports = { GC_HOUSEKEEPING_STATUS_OPTIONS };
