// Head Office forms — same shape as regalGardenForms.js (named checklists
// per form, since each form's checklist is its own distinct list, not a
// shared numeric range). Each checkpoint has a type: "photo" (default),
// "text", or "select" (a fixed-option dropdown on the public form, e.g.
// Yes/No — stored as a textAnswers entry same as "text"), and is required
// unless explicitly marked { required: false }. Form count is not yet known
// — more forms will be added here one at a time once the coordinator shares
// the checklist content.
function photo(label, opts = {}) {
  return { label, type: "photo", ...opts };
}

const HEAD_OFFICE_FORMS = [
  {
    formNumber: 1,
    label: "Male Washroom Form",
    checkpoints: [
      photo("Urinal (1+2+3)"),
      photo("WC-1"),
      photo("WC-2"),
      photo("WC-3"),
      photo("Dustbin"),
      photo("Mirror"),
      photo("Floor"),
      { label: "Handwash", type: "select", options: ["Yes", "No"] },
    ],
  },
  {
    formNumber: 2,
    label: "Female Washroom Form",
    checkpoints: [
      photo("WC-1"),
      photo("WC-2"),
      photo("WC-3"),
      photo("Dustbin"),
      photo("Mirror"),
      photo("Floor"),
      { label: "Handwash", type: "select", options: ["Yes", "No"] },
    ],
  },
  {
    formNumber: 3,
    label: "Guest Washroom Form",
    checkpoints: [
      photo("Urinal"),
      photo("WC-1"),
      photo("WC-2"),
      photo("Dustbin"),
      photo("Mirror"),
      photo("Floor"),
      { label: "Handwash", type: "select", options: ["Yes", "No"] },
    ],
  },
];

function getFormByNumber(formNumber) {
  return HEAD_OFFICE_FORMS.find((f) => f.formNumber === Number(formNumber));
}

module.exports = { HEAD_OFFICE_FORMS, getFormByNumber, photo };
