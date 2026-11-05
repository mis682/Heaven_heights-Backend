// Sample Apartment forms — same shape as milestoneForms.js. 3 forms expected,
// added once the coordinator shares their checkpoints.
function photo(label, opts = {}) {
  return { label, type: "photo", ...opts };
}

const SAMPLE_APARTMENT_FORMS = [
  {
    formNumber: 1,
    label: "EG Sample Apartments Cleaning Form",
    checkpoints: [
      photo("EG-101 2 BHK - Cleaning Image 1"),
      photo("EG-101 2 BHK - Cleaning Image 2"),
      photo("EG-102 2 BHK - Cleaning Image 1"),
      photo("EG-102 2 BHK - Cleaning Image 2"),
      photo("EG-117 3 BHK - Cleaning Image 1"),
      photo("EG-117 3 BHK - Cleaning Image 2"),
      photo("EG-118 1 RK - Cleaning Image 1"),
      photo("EG-118 1 RK - Cleaning Image 2"),
      photo("Villa-43 - Cleaning Image 1"),
      photo("Villa-43 - Cleaning Image 2"),
    ],
  },
  {
    formNumber: 2,
    label: "Garden City Sample Unit Cleaning Form",
    checkpoints: [
      photo("Flat-1 - Image 1"),
      photo("Flat-1 - Image 2"),
      photo("Flat-2 - Image 1"),
      photo("Flat-2 - Image 2"),
      photo("Flat-3 - Image 1"),
      photo("Flat-3 - Image 2"),
    ],
  },
  {
    formNumber: 3,
    label: "Regal Garden Sample Unit Form",
    checkpoints: [
      photo("Living Area (Villa)"),
      photo("Kitchen (Villa)"),
      photo("Store Room (Villa)"),
      photo("Balcony Area (Villa)"),
      photo("1st Room (First Floor-Villa)"),
      photo("2nd Room (First Floor-Villa)"),
      photo("1st Room (Second Floor-Villa)"),
      photo("2nd Room (Second Floor-Villa)"),
      photo("Pooja Room (Second Floor-Villa)"),
      photo("Servent Room (Third Floor-Villa)"),
      photo("Living Area (Panthouse)"),
      photo("Kitchen (Panthouse)"),
      photo("Dinning Area (Panthouse)"),
      photo("Balcony (Panthouse)"),
      photo("Room-1 (Panthouse)"),
      photo("Room-2 (Panthouse)"),
      photo("Room-3 (Panthouse)"),
      photo("Room-4 (Panthouse)"),
      photo("Servent Room (Panthouse)"),
    ],
  },
];

function getFormByNumber(formNumber) {
  return SAMPLE_APARTMENT_FORMS.find((f) => f.formNumber === Number(formNumber));
}

module.exports = { SAMPLE_APARTMENT_FORMS, getFormByNumber, photo };
