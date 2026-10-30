// School forms — same shape as milestoneForms.js. 2 forms expected,
// added once the coordinator shares their checkpoints — scaffolded
// empty for now.
function photo(label, opts = {}) {
  return { label, type: "photo", ...opts };
}

const SCHOOL_FORMS = [];

function getFormByNumber(formNumber) {
  return SCHOOL_FORMS.find((f) => f.formNumber === Number(formNumber));
}

module.exports = { SCHOOL_FORMS, getFormByNumber, photo };
