// Eden Garden forms — same shape as regalGardenForms.js (named checklists
// per form, since each form's checklist is its own distinct list, not a
// shared numeric range). Each checkpoint has a type: "photo" (default) or
// "text", and is required unless explicitly marked { required: false }.
// 2 forms expected, added once the coordinator shares them.
function photo(label, opts = {}) {
  return { label, type: "photo", ...opts };
}

const EDEN_GARDEN_FORMS = [
  {
    formNumber: 1,
    label: "EG Form-1",
    checkpoints: Array.from({ length: 10 }, (_, i) => i + 1)
      .flatMap((floor) => {
        const suffix = floor === 1 ? "st" : floor === 2 ? "nd" : floor === 3 ? "rd" : "th";
        return [photo(`Corridor-1 (${floor}${suffix} Floor)`), photo(`Corridor-2 (${floor}${suffix} Floor)`)];
      })
      .concat(photo("Fire System (Terrace Floor)")),
  },
];

function getFormByNumber(formNumber) {
  return EDEN_GARDEN_FORMS.find((f) => f.formNumber === Number(formNumber));
}

module.exports = { EDEN_GARDEN_FORMS, getFormByNumber, photo };
