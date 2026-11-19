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
  "aadharNumber",
  "panNumber",
  "uanNumber",
  "esicNumber",
  "bankName",
  "bankAccountNo",
  "bankIfscCode",
  "salary",
  "basicSalary",
  "grossSalary",
  "petrolAmount",
  "employeePf",
  "employerPf",
  "employeeEsic",
  "employerEsic",
  "salaryDeduction",
];
const NUMBER_FIELDS = new Set([
  "salary",
  "basicSalary",
  "grossSalary",
  "petrolAmount",
  "employeePf",
  "employerPf",
  "employeeEsic",
  "employerEsic",
  "salaryDeduction",
]);

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
    profile[f] = detail ? detail[f] : NUMBER_FIELDS.has(f) ? 0 : "";
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
    update[f] = NUMBER_FIELDS.has(f) ? Number(req.body[f]) || 0 : req.body[f];
  });

  await StaffProfileDetail.findOneAndUpdate({ employeeId }, update, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  });
  await exports.getProfile(req, res);
};
