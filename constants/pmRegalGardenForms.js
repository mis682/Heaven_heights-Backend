// Property Management — Regal Garden forms — same shape as
// regalGardenForms.js. Each checkpoint has a type: "photo" (default) or
// "text", and is required unless explicitly marked { required: false }.
// Form content not yet shared by the coordinator — starts empty, to be
// populated once it's provided.
function photo(label, opts = {}) {
  return { label, type: "photo", ...opts };
}

const PM_REGAL_GARDEN_FORMS = [];

function getFormByNumber(formNumber) {
  return PM_REGAL_GARDEN_FORMS.find((f) => f.formNumber === Number(formNumber));
}

module.exports = { PM_REGAL_GARDEN_FORMS, getFormByNumber, photo };
