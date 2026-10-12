// Nature Park forms — same shape as oneBusinessCenterForms.js (named
// checklists per form, since each form's checklist is its own distinct
// list, not a shared numeric range). Each checkpoint has a type: "photo"
// (default) or "text", and is required unless explicitly marked
// { required: false }. 2 forms expected, added as the coordinator shares them.
function photo(label, opts = {}) {
  return { label, type: "photo", ...opts };
}

const NATURE_PARK_FORMS = [];

function getFormByNumber(formNumber) {
  return NATURE_PARK_FORMS.find((f) => f.formNumber === Number(formNumber));
}

module.exports = { NATURE_PARK_FORMS, getFormByNumber, photo };
