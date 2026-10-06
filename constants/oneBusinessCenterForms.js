// One Business Center forms — same shape as reserveClubForms.js (named
// checklists per form, since each form's checklist is its own distinct
// list, not a shared numeric range). Each checkpoint has a type: "photo"
// (default) or "text", and is required unless explicitly marked
// { required: false }. Forms get appended as provided — 7 total expected.
function photo(label, opts = {}) {
  return { label, type: "photo", ...opts };
}

const ONE_BUSINESS_CENTER_FORMS = [
  {
    formNumber: 1,
    label: "Basement Form",
    checkpoints: [
      "Ramp (Basement-1)",
      "Basement Pic-1 (Basement-1)",
      "Basement Pic-2 (Basement-1)",
      "Basement Pic-3 (Basement-1)",
      "Basement Lift Lobby (Basement-1)",
      "Basement -(2) Pic 1 (Basement -2)",
      "Basement -(2) Pic 2 (Basement -2)",
      "Basement -(2) Lift Lobby (Basement -2)",
      "Fire Room (Basement-2)",
      "Mid Stair (Basement-2)",
      "Right Side Stair (Basement-2)",
      "Left Side Stair (Basement-2)",
    ].map((label) => photo(label)),
  },
];

function getFormByNumber(formNumber) {
  return ONE_BUSINESS_CENTER_FORMS.find((f) => f.formNumber === Number(formNumber));
}

module.exports = { ONE_BUSINESS_CENTER_FORMS, getFormByNumber, photo };
