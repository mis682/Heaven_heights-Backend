// Eden Garden forms — same shape as regalGardenForms.js (named checklists
// per form, since each form's checklist is its own distinct list, not a
// shared numeric range). Each checkpoint has a type: "photo" (default) or
// "text", and is required unless explicitly marked { required: false }.
// 2 forms expected, added once the coordinator shares them.
function photo(label, opts = {}) {
  return { label, type: "photo", ...opts };
}

const EDEN_GARDEN_FORMS = [];

function getFormByNumber(formNumber) {
  return EDEN_GARDEN_FORMS.find((f) => f.formNumber === Number(formNumber));
}

module.exports = { EDEN_GARDEN_FORMS, getFormByNumber, photo };
