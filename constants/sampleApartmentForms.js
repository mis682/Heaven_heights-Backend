// Sample Apartment forms — same shape as milestoneForms.js. 3 forms expected,
// added once the coordinator shares their checkpoints.
function photo(label, opts = {}) {
  return { label, type: "photo", ...opts };
}

const SAMPLE_APARTMENT_FORMS = [
  {
    formNumber: 1,
    label: "Sample Apartment Form 1",
    checkpoints: [photo("Placeholder Checkpoint")],
  },
  {
    formNumber: 2,
    label: "Sample Apartment Form 2",
    checkpoints: [photo("Placeholder Checkpoint")],
  },
  {
    formNumber: 3,
    label: "Sample Apartment Form 3",
    checkpoints: [photo("Placeholder Checkpoint")],
  },
];

function getFormByNumber(formNumber) {
  return SAMPLE_APARTMENT_FORMS.find((f) => f.formNumber === Number(formNumber));
}

module.exports = { SAMPLE_APARTMENT_FORMS, getFormByNumber, photo };
