const MaintenanceStaff = require("../models/MaintenanceStaff");
const StaffProfileDetail = require("../models/StaffProfileDetail");
const AttendanceOvertime = require("../models/AttendanceOvertime");
const { computeMonthSummary, statusTotals } = require("./attendanceScanController");
const { daysInCalendarMonth, computePayrollRow } = require("../utils/payrollCalc");
const { buildPayrollPdf } = require("../utils/payrollPdf");
const ExcelJS = require("exceljs");

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

exports.meta = async (req, res) => {
  const designations = await MaintenanceStaff.distinct("designation");
  res.json({ designations: designations.sort() });
};

// Builds one payroll row per staff member in the given designation for the
// given month — joins Staff Profile (salary inputs), Team Attendance
// (present/half-day/monthly-leave counts, same derivation as the Team
// Attendance page) and Overtime (monthly day count), then runs the same
// math as computePayrollRow. Grouped by site, each group carries its own
// subtotal — matching the existing manual sheet's layout — plus one grand
// total for the whole designation.
async function buildDesignationPayroll(designation, month, year) {
  const daysInMonth = daysInCalendarMonth(month, year);
  const staffList = await MaintenanceStaff.find({ designation }).sort({ siteName: 1, employeeId: 1 });
  if (staffList.length === 0) return { designation, month: Number(month), year: Number(year), daysInMonth, siteGroups: [], grandTotal: null };

  const [summary, details, overtimeEntries] = await Promise.all([
    computeMonthSummary({ month, year }),
    StaffProfileDetail.find({ employeeId: { $in: staffList.map((s) => s.employeeId) } }),
    AttendanceOvertime.find({ month: Number(month), year: Number(year), employeeId: { $in: staffList.map((s) => s.employeeId) } }),
  ]);
  const summaryByEmployee = new Map(summary.rows.map((r) => [r.employeeId, r]));
  const detailByEmployee = new Map(details.map((d) => [d.employeeId, d]));
  const overtimeByEmployee = new Map(overtimeEntries.map((o) => [o.employeeId, o.days]));

  const rows = staffList.map((staff, idx) => {
    const detail = detailByEmployee.get(staff.employeeId);
    const summaryRow = summaryByEmployee.get(staff.employeeId);
    const totals = summaryRow ? statusTotals(summaryRow.days) : { totalPresent: 0, totalHalfDay: 0, totalMonthlyLeave: 0 };
    const presentDays = totals.totalPresent + totals.totalHalfDay * 0.5;
    const leaveAllowed = totals.totalMonthlyLeave;
    const overTime = overtimeByEmployee.get(staff.employeeId) || 0;

    const salary = detail?.salary || 0;
    const petrol = detail?.petrolAmount || 0;
    const basic = detail?.basicSalary || 0;
    const salaryDeduction = detail?.salaryDeduction || 0;

    const calc = computePayrollRow({ salary, petrol, basic, salaryDeduction, presentDays, leaveAllowed, overTime, daysInMonth });

    return {
      sNo: idx + 1,
      siteName: staff.siteName,
      employeeName: staff.name,
      employeeId: staff.employeeId,
      bankAccountNo: detail?.bankAccountNo || "",
      bankName: detail?.bankName || "",
      bankIfscCode: detail?.bankIfscCode || "",
      salary,
      petrol,
      daysInMonth,
      presentDays,
      leaveAllowed,
      overTime,
      ...calc,
      uanNumber: detail?.uanNumber || "",
      esicNumber: detail?.esicNumber || "",
      aadharNumber: detail?.aadharNumber || "",
      panNumber: detail?.panNumber || "",
    };
  });

  const bySite = new Map();
  rows.forEach((r) => {
    if (!bySite.has(r.siteName)) bySite.set(r.siteName, []);
    bySite.get(r.siteName).push(r);
  });

  const sumFields = ["salary", "petrol", "totalDays", "gross", "hra", "basic", "employeePf", "employerPf", "employeeEsic", "employerEsic", "salaryDeduction", "salaryPayable", "totalCtc"];
  const emptySum = () => sumFields.reduce((acc, f) => ({ ...acc, [f]: 0 }), {});
  const addInto = (sum, r) => sumFields.forEach((f) => { sum[f] += r[f]; });

  const siteGroups = [...bySite.entries()].map(([siteName, siteRows]) => {
    const subtotal = emptySum();
    siteRows.forEach((r) => addInto(subtotal, r));
    return { siteName, rows: siteRows, subtotal };
  });

  const grandTotal = emptySum();
  rows.forEach((r) => addInto(grandTotal, r));

  return { designation, month: Number(month), year: Number(year), daysInMonth, siteGroups, grandTotal };
}

exports.getDesignationPayroll = async (req, res) => {
  const { designation } = req.params;
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ message: "month and year are required" });
  const payroll = await buildDesignationPayroll(designation, month, year);
  res.json(payroll);
};

exports.exportExcel = async (req, res) => {
  const { designation } = req.params;
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ message: "month and year are required" });
  const payroll = await buildDesignationPayroll(designation, month, year);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(designation.slice(0, 31));
  sheet.columns = [
    { header: "S No", key: "sNo", width: 6 },
    { header: "Site Name", key: "siteName", width: 16 },
    { header: "Employee Name", key: "employeeName", width: 22 },
    { header: "E.ID", key: "employeeId", width: 10 },
    { header: "Bank Account Number", key: "bankAccountNo", width: 20 },
    { header: "Bank Name", key: "bankName", width: 14 },
    { header: "Bank IFSC Code", key: "bankIfscCode", width: 14 },
    { header: "Salary", key: "salary", width: 10 },
    { header: "Petrol", key: "petrol", width: 9 },
    { header: "Days in Month", key: "daysInMonth", width: 10 },
    { header: "Present Days", key: "presentDays", width: 11 },
    { header: "Leave Allowed", key: "leaveAllowed", width: 11 },
    { header: "Over Time", key: "overTime", width: 9 },
    { header: "Total Days", key: "totalDays", width: 10 },
    { header: "Rate", key: "rate", width: 8 },
    { header: "Gross", key: "gross", width: 10 },
    { header: "HRA", key: "hra", width: 9 },
    { header: "Basic", key: "basic", width: 9 },
    { header: "Employee PF", key: "employeePf", width: 11 },
    { header: "Employer PF", key: "employerPf", width: 11 },
    { header: "Employee ESIC", key: "employeeEsic", width: 12 },
    { header: "Employer ESIC", key: "employerEsic", width: 12 },
    { header: "Salary Deduction", key: "salaryDeduction", width: 13 },
    { header: "Salary Payable", key: "salaryPayable", width: 13 },
    { header: "Total CTC", key: "totalCtc", width: 11 },
    { header: "UAN Number", key: "uanNumber", width: 14 },
    { header: "ESIC Number", key: "esicNumber", width: 14 },
    { header: "Aadhar Number", key: "aadharNumber", width: 14 },
    { header: "PAN Number", key: "panNumber", width: 12 },
  ];
  sheet.getRow(1).font = { bold: true };

  payroll.siteGroups.forEach((group) => {
    group.rows.forEach((r) => sheet.addRow(r));
    const subtotalRow = sheet.addRow({ employeeName: `Total — ${group.siteName}`, ...group.subtotal });
    subtotalRow.font = { bold: true };
  });
  if (payroll.grandTotal) {
    const totalRow = sheet.addRow({ employeeName: `Total Amount of ${designation} Salary`, ...payroll.grandTotal });
    totalRow.font = { bold: true };
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=payroll-${designation.toLowerCase().replace(/\s+/g, "-")}-${MONTH_NAMES[month - 1]}-${year}.xlsx`
  );
  await workbook.xlsx.write(res);
  res.end();
};

exports.exportPdf = async (req, res) => {
  const { designation } = req.params;
  const { month, year, download } = req.query;
  if (!month || !year) return res.status(400).json({ message: "month and year are required" });
  const payroll = await buildDesignationPayroll(designation, month, year);

  res.setHeader("Content-Type", "application/pdf");
  const filename = `payroll-${designation.toLowerCase().replace(/\s+/g, "-")}-${MONTH_NAMES[month - 1]}-${year}.pdf`;
  res.setHeader("Content-Disposition", `${download ? "attachment" : "inline"}; filename=${filename}`);

  const doc = buildPayrollPdf(payroll, `${designation} — ${MONTH_NAMES[month - 1]} ${year}`);
  doc.pipe(res);
  doc.end();
};
