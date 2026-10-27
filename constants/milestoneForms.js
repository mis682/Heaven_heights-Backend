// Milestone forms — same shape as neoMeridianForms.js (named checklists per
// form, since each form's checklist is its own distinct list, not a shared
// numeric range). Each checkpoint has a type: "photo" (default) or "text",
// and is required unless explicitly marked { required: false }.
// 1 form expected, added once the coordinator shares it.
function photo(label, opts = {}) {
  return { label, type: "photo", ...opts };
}

const MILESTONE_FORMS = [
  {
    formNumber: 1,
    label: "Milestone Cleaning Form",
    checkpoints: [
      "2nd Floor Cleaning Pic",
      "3rd Floor Cleaning Pic",
      "Washroom Cleaning Pic at 3rd Floor",
      "4th Floor Cleaning Pic",
      "5th Floor Cleaning Pic",
      "Washroom Cleaning Pic at 5th Floor",
      "Swimming Pool Cleaning Pic",
      "Common Area Cleaning Pic",
      "Lift-1 Cleaning Pic",
      "Lift-2 Cleaning Pic",
      "Maintenance Incharge Uniform Image",
    ].map((label) => photo(label)),
  },
];

function getFormByNumber(formNumber) {
  return MILESTONE_FORMS.find((f) => f.formNumber === Number(formNumber));
}

module.exports = { MILESTONE_FORMS, getFormByNumber, photo };
