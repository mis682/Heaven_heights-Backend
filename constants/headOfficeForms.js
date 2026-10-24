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
  {
    formNumber: 4,
    label: "Chairman Washroom Form",
    checkpoints: [
      photo("Urinal"),
      photo("WC"),
      photo("Mirror"),
      photo("Dustbin"),
      photo("Floor"),
      { label: "Handwash", type: "select", options: ["Yes", "No"] },
    ],
  },
  {
    formNumber: 5,
    label: "Handicap Washroom Form",
    checkpoints: [
      photo("WC"),
      photo("Floor"),
      photo("Mirror"),
      photo("Dustbin"),
      { label: "Handwash", type: "select", options: ["Yes", "No"] },
    ],
  },
  {
    formNumber: 6,
    label: "Desk Cleaning Form",
    checkpoints: [
      "MDO Workstation Desk",
      "Ananya Mam Desk",
      "Rahul Sir Desk",
      "Yogesh Sir Desk",
      "Jalaj Sir Desk",
      "Rakesh Sir Desk",
      "AGM Cabin Desk-1",
      "AGM Cabin Desk-2",
      "CRM Desk",
      "Account Desk",
      "HR Desk",
      "Marketing-1 Desk",
      "Marketing-2 Desk",
      "Conference Desk",
      "Lunch Room table",
      "Jinesh Sir Desk",
      "Reception Desk (Counter)",
      "Bade Sir Desk",
      "Monika Desk",
      "Bade Sir Workstation Desk",
      "Kitchen",
      "Huddle Room-1 Desk",
      "Huddle Room-2 Desk",
      "Huddle Room-3 Desk",
      "Huddle Room-4 Desk",
    ].map((label) => photo(label)),
  },
];

function getFormByNumber(formNumber) {
  return HEAD_OFFICE_FORMS.find((f) => f.formNumber === Number(formNumber));
}

module.exports = { HEAD_OFFICE_FORMS, getFormByNumber, photo };
