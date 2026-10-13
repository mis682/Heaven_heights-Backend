// Property Management — Garden City forms — same shape as
// regalGardenForms.js. Each checkpoint has a type: "photo" (default) or
// "text", and is required unless explicitly marked { required: false }.
// Form content not yet shared by the coordinator — starts empty, to be
// populated once it's provided.
function photo(label, opts = {}) {
  return { label, type: "photo", ...opts };
}

const PM_GARDEN_CITY_FORMS = [
  {
    formNumber: 1,
    label: "Unit Photographs Form",
    checkpoints: [
      { label: "Unit No.", type: "text" },
      photo("Kitchen Photo", { required: false }),
      photo("Washroom Photo-1", { required: false }),
      photo("Washroom Photo-2", { required: false }),
      photo("Washroom Photo-3", { required: false }),
      photo("Balcony", { required: false }),
      photo("Photo-1", { required: false }),
      photo("Photo-2", { required: false }),
      photo("Photo-3", { required: false }),
    ],
  },
];

function getFormByNumber(formNumber) {
  return PM_GARDEN_CITY_FORMS.find((f) => f.formNumber === Number(formNumber));
}

module.exports = { PM_GARDEN_CITY_FORMS, getFormByNumber, photo };
