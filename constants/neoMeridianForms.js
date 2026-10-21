// Neo Meridian forms — same shape as regalGardenForms.js (named checklists
// per form, since each form's checklist is its own distinct list, not a
// shared numeric range). Each checkpoint has a type: "photo" (default) or
// "text", and is required unless explicitly marked { required: false }.
// 1 form expected, added once the coordinator shares it.
function photo(label, opts = {}) {
  return { label, type: "photo", ...opts };
}

const NEO_MERIDIAN_FORMS = [];

function getFormByNumber(formNumber) {
  return NEO_MERIDIAN_FORMS.find((f) => f.formNumber === Number(formNumber));
}

module.exports = { NEO_MERIDIAN_FORMS, getFormByNumber, photo };
