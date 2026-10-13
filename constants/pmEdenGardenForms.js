// Property Management — Eden Garden forms — same shape as
// regalGardenForms.js. Each checkpoint has a type: "photo" (default) or
// "text", and is required unless explicitly marked { required: false }.
// Form content not yet shared by the coordinator — starts empty, to be
// populated once it's provided.
function photo(label, opts = {}) {
  return { label, type: "photo", ...opts };
}

const PM_EDEN_GARDEN_FORMS = [];

function getFormByNumber(formNumber) {
  return PM_EDEN_GARDEN_FORMS.find((f) => f.formNumber === Number(formNumber));
}

module.exports = { PM_EDEN_GARDEN_FORMS, getFormByNumber, photo };
