// Nature Park forms — same shape as oneBusinessCenterForms.js (named
// checklists per form, since each form's checklist is its own distinct
// list, not a shared numeric range). Each checkpoint has a type: "photo"
// (default) or "text", and is required unless explicitly marked
// { required: false }. 2 forms expected, added as the coordinator shares them.
function photo(label, opts = {}) {
  return { label, type: "photo", ...opts };
}

const NATURE_PARK_FORMS = [
  {
    formNumber: 1,
    label: "Nature Park-1",
    checkpoints: [
      "Western Plaza Light Pic",
      "Northern Park Light Pic",
      "Central Park Light Pic",
      "Western Plaza Fountain Pic",
      "Main Gate Fountain Pic",
      "Maintenance office Pic",
      "Cricket Ground Pic",
      "Basketball Court Pic",
    ].map((label) => photo(label)),
  },
  {
    formNumber: 2,
    label: "Nature Park-2",
    checkpoints: [
      "Centre Fountain Pic",
      "Western Plaza Fountain Pic",
      "Road Pic",
      "Central Park Bio Pond Pic",
      "Northern Park Bio Pond Pic",
      "Northern Park Tile Pic",
      "Central Park Tile Pic",
      "Western Plaza Tile Pic",
      "Kids Play Area-1 Pic",
      "Kids Play Area-2 Pic",
      "Northern Park Clean Pic",
      "Central Park Clean Pic",
      "Western Plaza Clean Pic",
      "Main Gate Fountain Pic",
      "Central Park Raindance Pic",
      "Northern Park Raindance Pic",
      "Basketball Court Clean Pic",
      "Uniform Pic",
    ].map((label) => photo(label)),
  },
];

function getFormByNumber(formNumber) {
  return NATURE_PARK_FORMS.find((f) => f.formNumber === Number(formNumber));
}

module.exports = { NATURE_PARK_FORMS, getFormByNumber, photo };
