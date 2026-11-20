const MaintenanceStaff = require("../models/MaintenanceStaff");
const StaffProfileDetail = require("../models/StaffProfileDetail");

// Core identity fields (name, designation, site, company, photo) always
// come from MaintenanceStaff — the same record the admin fills in when
// generating a staff member's QR code — and are read-only here. Everything
// else is HR-editable detail, stored separately in StaffProfileDetail.
const DETAIL_FIELDS = [
  "dateOfBirth",
  "joiningDate",
  "contactNumber",
  "bloodGroup",
  "maritalStatus",
  "emergencyContactName",
  "emergencyContactPhone",
  "scheduledPunchInTime",
  "scheduledPunchOutTime",
  "currentPinCode",
  "currentAddressLine",
  "currentCity",
  "currentState",
  "permanentSameAsCurrent",
  "permanentPinCode",
  "permanentAddressLine",
  "permanentCity",
  "permanentState",
  "aadharNumber",
  "panNumber",
  "uanNumber",
  "esicNumber",
  "bankHolderName",
  "bankName",
  "branchName",
  "bankAccountNo",
  "bankIfscCode",
  "salary",
  "basicSalary",
  "petrolAmount",
  "salaryDeduction",
];
const NUMBER_FIELDS = new Set(["salary", "basicSalary", "petrolAmount", "salaryDeduction"]);
const BOOLEAN_FIELDS = new Set(["permanentSameAsCurrent"]);

exports.getProfile = async (req, res) => {
  const { employeeId } = req.params;
  const staff = await MaintenanceStaff.findOne({ employeeId });
  if (!staff) return res.status(404).json({ message: "Staff not found" });
  const detail = await StaffProfileDetail.findOne({ employeeId });

  const profile = {
    employeeId: staff.employeeId,
    name: staff.name,
    designation: staff.designation,
    siteName: staff.siteName,
    companyName: staff.companyName || "",
    photo: staff.photo || "",
  };
  DETAIL_FIELDS.forEach((f) => {
    if (detail) {
      profile[f] = detail[f];
    } else if (BOOLEAN_FIELDS.has(f)) {
      profile[f] = true;
    } else {
      profile[f] = NUMBER_FIELDS.has(f) ? 0 : "";
    }
  });
  res.json(profile);
};

exports.updateProfile = async (req, res) => {
  const { employeeId } = req.params;
  const staff = await MaintenanceStaff.findOne({ employeeId });
  if (!staff) return res.status(404).json({ message: "Staff not found" });

  const update = {};
  DETAIL_FIELDS.forEach((f) => {
    if (req.body[f] === undefined) return;
    if (NUMBER_FIELDS.has(f)) update[f] = Number(req.body[f]) || 0;
    else if (BOOLEAN_FIELDS.has(f)) update[f] = Boolean(req.body[f]);
    else update[f] = req.body[f];
  });

  await StaffProfileDetail.findOneAndUpdate({ employeeId }, update, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  });
  await exports.getProfile(req, res);
};

// Looks up city/state for a 6-digit Indian PIN code via the public India
// Post API — proxied through our own backend (not called directly from
// the browser) to sidestep any CORS restrictions on that API.
exports.lookupPincode = async (req, res) => {
  const { code } = req.params;
  if (!/^\d{6}$/.test(code)) return res.status(400).json({ message: "A 6-digit PIN code is required" });

  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${code}`);
    const data = await response.json();
    const postOffice = data?.[0]?.PostOffice?.[0];
    if (!postOffice) return res.status(404).json({ message: "PIN code not found" });
    res.json({ city: postOffice.District, state: postOffice.State });
  } catch {
    res.status(502).json({ message: "PIN code lookup failed" });
  }
};
