const mongoose = require("mongoose");

// HR/financial detail fields for a staff member, kept separate from
// MaintenanceStaff (which stays the single source for core identity fields
// — name, employeeId, siteName, designation, companyName, photo — already
// used across attendance/forms) so this sensitive data has its own
// collection. One document per employeeId, filled in gradually by HR via
// the Staff Profile page.
const StaffProfileDetailSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, unique: true, trim: true },
    dateOfBirth: { type: String, default: "" },
    joiningDate: { type: String, default: "" },
    contactNumber: { type: String, default: "" },
    bloodGroup: { type: String, default: "" },
    maritalStatus: { type: String, default: "" },
    emergencyContactName: { type: String, default: "" },
    emergencyContactPhone: { type: String, default: "" },
    currentPinCode: { type: String, default: "" },
    currentAddressLine: { type: String, default: "" },
    currentCity: { type: String, default: "" },
    currentState: { type: String, default: "" },
    // When true, Permanent Address mirrors Current Address in the UI
    // instead of being entered separately.
    permanentSameAsCurrent: { type: Boolean, default: true },
    permanentPinCode: { type: String, default: "" },
    permanentAddressLine: { type: String, default: "" },
    permanentCity: { type: String, default: "" },
    permanentState: { type: String, default: "" },
    aadharNumber: { type: String, default: "" },
    panNumber: { type: String, default: "" },
    uanNumber: { type: String, default: "" },
    esicNumber: { type: String, default: "" },
    bankHolderName: { type: String, default: "" },
    bankName: { type: String, default: "" },
    branchName: { type: String, default: "" },
    bankAccountNo: { type: String, default: "" },
    bankIfscCode: { type: String, default: "" },
    salary: { type: Number, default: 0 },
    basicSalary: { type: Number, default: 0 },
    grossSalary: { type: Number, default: 0 },
    petrolAmount: { type: Number, default: 0 },
    // Set by HR whenever a one-off amount (e.g. an advance recovery) needs
    // to come out of this month's payroll — not tied to a specific month,
    // HR resets it to 0 once recovered.
    salaryDeduction: { type: Number, default: 0 },
    employeePf: { type: Number, default: 0 },
    employerPf: { type: Number, default: 0 },
    employeeEsic: { type: Number, default: 0 },
    employerEsic: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StaffProfileDetail", StaffProfileDetailSchema);
