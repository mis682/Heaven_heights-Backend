// Garden City's 150 housekeeping checkpoints are split across 4 public
// forms so no single person has to photograph all of them in one sitting —
// each form covers a fixed, non-overlapping checkpoint range. Mirrors
// client/src/layouts/navConfig.js's GC_HOUSEKEEPING_FORMS — kept in sync
// manually, same convention as PATROL_SITES there (static, rarely changes).
const GC_HOUSEKEEPING_FORMS = [
  { formNumber: 1, label: "GC Form 1", checkpointStart: 1, checkpointEnd: 40 },
  { formNumber: 2, label: "GC Form 2", checkpointStart: 41, checkpointEnd: 80 },
  { formNumber: 3, label: "GC Form 3", checkpointStart: 81, checkpointEnd: 120 },
  { formNumber: 4, label: "GC Form 4", checkpointStart: 121, checkpointEnd: 150 },
];

function getFormByNumber(formNumber) {
  return GC_HOUSEKEEPING_FORMS.find((f) => f.formNumber === Number(formNumber));
}

module.exports = { GC_HOUSEKEEPING_FORMS, getFormByNumber };
