// Weekly Update Other Projects forms — same shape as neoMeridianForms.js
// (named checklists per form, since each form's checklist is its own
// distinct list, not a shared numeric range). Each checkpoint has a type:
// "photo" (default) or "text", and is required unless explicitly marked
// { required: false }.
// 1 form expected, added once the coordinator shares it.
function photo(label, opts = {}) {
  return { label, type: "photo", ...opts };
}

const WEEKLY_UPDATE_FORMS = [
  {
    formNumber: 1,
    label: "Weekly Update Form",
    checkpoints: [
      "Image of Gulmohar City",
      "Image of Orchid Green",
      "Image of Green Park",
      "Image of Garden Place",
    ].map((label) => photo(label)),
  },
];

function getFormByNumber(formNumber) {
  return WEEKLY_UPDATE_FORMS.find((f) => f.formNumber === Number(formNumber));
}

module.exports = { WEEKLY_UPDATE_FORMS, getFormByNumber, photo };
