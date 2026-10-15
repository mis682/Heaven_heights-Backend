// Regal Garden forms — same shape as natureParkForms.js (named checklists
// per form, since each form's checklist is its own distinct list, not a
// shared numeric range). Each checkpoint has a type: "photo" (default) or
// "text", and is required unless explicitly marked { required: false }.
// 1 form expected, added once the coordinator shares it.
function photo(label, opts = {}) {
  return { label, type: "photo", ...opts };
}

const REGAL_GARDEN_FORMS = [
  {
    formNumber: 1,
    label: "Regal Garden Cleaning Checkpoint",
    checkpoints: Array.from({ length: 12 }, (_, i) => `Checkpoint ${i + 1}`).map((label) => photo(label)),
  },
  {
    formNumber: 2,
    label: "RG-1",
    checkpoints: Array.from({ length: 13 }, (_, i) => i + 3).flatMap((floor) => {
      const suffix = floor === 3 ? "rd" : "th";
      return [photo(`Corridor (${floor}${suffix} Floor)`), photo(`Dustbin (${floor}${suffix} Floor)`)];
    }),
  },
  {
    formNumber: 3,
    label: "RG-2",
    checkpoints: [
      "Reception Area (Ground Floor)",
      "Male Washroom (Ground Floor)",
      "Female Washroom (Ground Floor)",
      "Gallery Photo (Ground Floor)",
      "Service Lift",
      "Passenger Lift-1",
      "Passenger Lift-2",
      "Parking-1 (Basement 1)",
      "Parking-2 (Basement 1)",
      "Parking-3 (Basement 1)",
      "Parking-1 (Basement 2)",
      "Parking-2 (Basement 2)",
      "Fire Room (Basement 2)",
      "Pump Room (Basement 2)",
    ].map((label) => photo(label)),
  },
  {
    formNumber: 4,
    label: "RG-Commercial Form",
    checkpoints: [
      "1st Floor Corridor-1",
      "1st Floor Corridor-2",
      "1st Floor Dustbin",
      "1st Floor Male Washroom",
      "1st Floor Female Washroom",
      "2nd Floor Corridor-1",
      "2nd Floor Corridor-2",
      "2nd Floor Dustbin",
      "2nd Floor Male Washroom",
      "2nd Floor Female Washroom",
      "Commercial Lift",
      "Escalator",
      "Outer Stairs",
      "Parking",
      "Fountain-Regal Centre",
      "Fountain-Regal Garden",
    ].map((label) => photo(label)),
  },
];

function getFormByNumber(formNumber) {
  return REGAL_GARDEN_FORMS.find((f) => f.formNumber === Number(formNumber));
}

module.exports = { REGAL_GARDEN_FORMS, getFormByNumber, photo };
