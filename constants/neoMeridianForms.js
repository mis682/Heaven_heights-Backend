// Neo Meridian forms — same shape as regalGardenForms.js (named checklists
// per form, since each form's checklist is its own distinct list, not a
// shared numeric range). Each checkpoint has a type: "photo" (default) or
// "text", and is required unless explicitly marked { required: false }.
// 1 form expected, added once the coordinator shares it.
function photo(label, opts = {}) {
  return { label, type: "photo", ...opts };
}

const NEO_MERIDIAN_FORMS = [
  {
    formNumber: 1,
    label: "GST Cleaning Form",
    checkpoints: [
      "Basement Parking 2",
      "1st Floor Washroom",
      "Basement Parking 1",
      "Common Gallery Back Side",
      "Basement Parking 3",
      "1st Floor Female Washroom",
      "Fire Room",
      "Electric Room",
      "Common Gallery Sale Tax Office",
      "1st Floor Water Cooler",
      "Lift 1 Internal",
      "Lift 2 Internal",
      "Lift Room",
      "Main Gate Stairs",
      "Main Gate Common Parking",
      "Sale Tax 2nd Floor Balcony Area",
      "Main Road Common Parking 2",
      "Sale Tax Common Gallery Washroom",
      "Staircase Barista Side",
      "Staircase Car 24 Side",
      "Terrace Area Near Lift Room",
      "Terrace Pic 1",
      "Terrace Pic 2",
    ].map((label) => photo(label)),
  },
];

function getFormByNumber(formNumber) {
  return NEO_MERIDIAN_FORMS.find((f) => f.formNumber === Number(formNumber));
}

module.exports = { NEO_MERIDIAN_FORMS, getFormByNumber, photo };
