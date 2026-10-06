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
  {
    formNumber: 2,
    label: "Ground Floor Form",
    checkpoints: [
      "Reception (Ground Floor)",
      "Lift Lobby (Ground Floor)",
      "Male Washroom (Ground Floor)",
      "Female Washroom (Ground Floor)",
      "Handicap Washroom (Ground Floor)",
      "Exit Ramp Terrace (Ground Floor)",
      "Washroom Terrace (Ground Floor)",
      "Back Side Floor (Ground Floor)",
      "Road Side Floor (Ground Floor)",
      "Right Side Floor (Ground Floor)",
      "Left Side Floor (Ground Floor)",
      "Control Room (Ground Floor)",
    ].map((label) => photo(label)),
  },
  {
    formNumber: 3,
    label: "First Floor Form",
    checkpoints: [
      "Lift Lobby (First Floor)",
      "Lift Lobby to Left Side (First Floor)",
      "Lift Lobby to Right Side (First Floor)",
      "CCTV Monitor Screen Pic",
    ].map((label) => photo(label)),
  },
];

function getFormByNumber(formNumber) {
  return ONE_BUSINESS_CENTER_FORMS.find((f) => f.formNumber === Number(formNumber));
}

module.exports = { ONE_BUSINESS_CENTER_FORMS, getFormByNumber, photo };
