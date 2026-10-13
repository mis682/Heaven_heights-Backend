// Regal Garden forms — same shape as natureParkForms.js (named checklists
// per form, since each form's checklist is its own distinct list, not a
// shared numeric range). Each checkpoint has a type: "photo" (default) or
// "text", and is required unless explicitly marked { required: false }.
// 1 form expected, added once the coordinator shares it.
function photo(label, opts = {}) {
  return { label, type: "photo", ...opts };
}

const REGAL_GARDEN_FORMS = [
  {
    formNumber: 1,
    label: "Regal Garden Cleaning Checkpoint",
    checkpoints: Array.from({ length: 12 }, (_, i) => `Checkpoint ${i + 1}`).map((label) => photo(label)),
  },
];

function getFormByNumber(formNumber) {
  return REGAL_GARDEN_FORMS.find((f) => f.formNumber === Number(formNumber));
}

module.exports = { REGAL_GARDEN_FORMS, getFormByNumber, photo };
