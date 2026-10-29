// Hyde Park forms — same shape as milestoneForms.js / headOfficeForms.js
// (named checklists per form, since each form's checklist is its own
// distinct list, not a shared numeric range). Each checkpoint has a type:
// "photo" (default), "text", or "select" (a fixed-option dropdown on the
// public form, e.g. Yes/No — stored as a textAnswers entry same as "text"),
// and is required unless explicitly marked { required: false }.
// 1 form expected, added once the coordinator shares it.
function photo(label, opts = {}) {
  return { label, type: "photo", ...opts };
}

const HYDE_PARK_FORMS = [
  {
    formNumber: 1,
    label: "Hyde Park Cleaning Form",
    checkpoints: [
      photo("Image of Boundary-1"),
      photo("Image of Boundary-2"),
      photo("Image of Boundary-3"),
      photo("Image of Boundary-4"),
      photo("Image of Water Motor"),
      photo("Maintenance Incharge Uniform Image"),
      { label: "Water Coming in Motor", type: "select", options: ["Yes", "No"] },
    ],
  },
];

function getFormByNumber(formNumber) {
  return HYDE_PARK_FORMS.find((f) => f.formNumber === Number(formNumber));
}

module.exports = { HYDE_PARK_FORMS, getFormByNumber, photo };
