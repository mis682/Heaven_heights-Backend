// School forms — same shape as milestoneForms.js. 2 forms expected,
// added once the coordinator shares their checkpoints.
function photo(label, opts = {}) {
  return { label, type: "photo", ...opts };
}

const SCHOOL_FORMS = [
  {
    formNumber: 1,
    label: "External Area School Cleaning Form",
    checkpoints: [
      photo("Basket Ball Court"),
      photo("Cricket Ground"),
      photo("Football Ground"),
      photo("Lawn Tenis Area"),
      photo("Skateing Area"),
      photo("Gate 1 to Gate 2 Main Road (External Side)"),
      photo("Gate 1 to Gate 2 Main Road (Internal Side)"),
      photo("Bus Stand Garden"),
      photo("Gate 2 to Back Side Area End"),
      photo("Gate 1 to Back Side Area End"),
      photo("Outdoor Activity area at Ground Floor"),
      photo("Terrace Cleaning (Only Sunday)", { required: false }),
    ],
  },
];

function getFormByNumber(formNumber) {
  return SCHOOL_FORMS.find((f) => f.formNumber === Number(formNumber));
}

module.exports = { SCHOOL_FORMS, getFormByNumber, photo };
