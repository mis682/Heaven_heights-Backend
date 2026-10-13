// Nature Park forms — same shape as oneBusinessCenterForms.js (named
// checklists per form, since each form's checklist is its own distinct
// list, not a shared numeric range). Each checkpoint has a type: "photo"
// (default) or "text", and is required unless explicitly marked
// { required: false }. 2 forms expected, added as the coordinator shares them.
function photo(label, opts = {}) {
  return { label, type: "photo", ...opts };
}

const NATURE_PARK_FORMS = [
  {
    formNumber: 1,
    label: "Nature Park-1",
    checkpoints: [
      "Western Plaza Light Pic",
      "Northern Park Light Pic",
      "Central Park Light Pic",
      "Western Plaza Fountain Pic",
      "Main Gate Fountain Pic",
      "Maintenance office Pic",
      "Cricket Ground Pic",
      "Basketball Court Pic",
    ].map((label) => photo(label)),
  },
];

function getFormByNumber(formNumber) {
  return NATURE_PARK_FORMS.find((f) => f.formNumber === Number(formNumber));
}

module.exports = { NATURE_PARK_FORMS, getFormByNumber, photo };
