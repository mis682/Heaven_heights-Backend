// Head Office forms — same shape as regalGardenForms.js (named checklists
// per form, since each form's checklist is its own distinct list, not a
// shared numeric range). Each checkpoint has a type: "photo" (default) or
// "text", and is required unless explicitly marked { required: false }.
// Form count is not yet known — forms will be added here one at a time once
// the coordinator shares the checklist content.
function photo(label, opts = {}) {
  return { label, type: "photo", ...opts };
}

const HEAD_OFFICE_FORMS = [];

function getFormByNumber(formNumber) {
  return HEAD_OFFICE_FORMS.find((f) => f.formNumber === Number(formNumber));
}

module.exports = { HEAD_OFFICE_FORMS, getFormByNumber, photo };
