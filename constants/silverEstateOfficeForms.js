// Silver Estate Office forms — same shape as hydeParkForms.js / milestoneForms.js
// (named checklist, single form). All 44 checkpoints are plain photo
// checkpoints — no text/select-type rows in this one. 1 form.
function photo(label, opts = {}) {
  return { label, type: "photo", ...opts };
}

const SILVER_ESTATE_OFFICE_FORMS = [
  {
    formNumber: 1,
    label: "Silver Estate Office Cleaning Form",
    checkpoints: [
      "Parking Area -1",
      "Parking Area -2",
      "Parking Area  Dustbin",
      "Reception Mirror-1",
      "Reception Mirror-2",
      "Reception Desk",
      "Reception Area-1",
      "Reception Area-2",
      "Reception Dustbin",
      "Reception  Area  Dustbin",
      "Guest Area-1",
      "Guest Area-2",
      "Guest Area Miror-1",
      "Guest Area Miror-2",
      "Guest Area Miror-3",
      "Guest Area Dustbin",
      "Kitchen",
      "Kitchen Bartan",
      "Kitchen Dustbin",
      "Conference Mirror-1",
      "Conference Mirror-2",
      "Conference Area-1",
      "Conference Area-2",
      "Conference Dustbin",
      "Ajay Sir Cabin-1",
      "Ajay Sir Cabin-2",
      "Ajay Sir Cabin Dustbin",
      "Washroom-1  Cleaning",
      "Washroom-2  Cleaning",
      "Washroom-1  Dustbin",
      "Washroom-2  Dustbin",
      "Sales Area-1",
      "Sales Area-2",
      "Sales Area Dustbin",
      "Lunch Room Cleaning",
      "Lunch Room Dustbin",
      "Aditya Sir Cabin",
      "Aditya Sir Cabin Dustbin",
      "Bade Sir Cabin",
      "Bade Sir Desk",
      "Bade Sir Cabin  Dustbin",
      "Workstation Area-1",
      "Workstation Area-2",
      "Workstation Area Dustbin",
    ].map((label) => photo(label)),
  },
];

function getFormByNumber(formNumber) {
  return SILVER_ESTATE_OFFICE_FORMS.find((f) => f.formNumber === Number(formNumber));
}

module.exports = { SILVER_ESTATE_OFFICE_FORMS, getFormByNumber, photo };
