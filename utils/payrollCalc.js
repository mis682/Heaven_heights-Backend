// Payroll math reverse-engineered from the user's own existing manual
// salary sheet (HEAVEN HEIGHTS PVT LTD, October 2026) — see commit message
// for the worked examples this was checked against. HR uses the generated
// sheet as the base for their final one, so edge cases (cash-paid staff,
// one-off manual overrides) are left for HR to adjust in the exported file
// rather than guessed at here.
const PF_RATE = 0.12; // both employee and employer side, of Basic
const ESIC_EMPLOYEE_RATE = 0.0075;
const ESIC_EMPLOYER_RATE = 0.0325;
const ESIC_GROSS_CEILING = 21000; // ESIC doesn't apply above this Gross

function daysInCalendarMonth(month, year) {
  return new Date(Number(year), Number(month), 0).getDate();
}

// `presentDays` should already fold in Half Day as 0.5 (same convention as
// Team Attendance's Payable Days) — Monthly Leave is passed separately as
// `leaveAllowed` since it has its own column in the sheet, and `overTime`
// comes from the Overtime submodule's monthly day count.
function computePayrollRow({ salary, petrol, basic, salaryDeduction, presentDays, leaveAllowed, overTime, daysInMonth }) {
  const totalDays = Math.round((presentDays + leaveAllowed + overTime) * 100) / 100;
  // Rate and Gross are the same flat, full-month figures as Staff Profile's
  // Salary & Statutory Details (computeSalaryBreakdown on the frontend) —
  // not prorated by attendance. totalDays is still shown as its own column.
  const rate = daysInMonth > 0 ? Math.round((salary + petrol) / daysInMonth) : 0;
  const gross = daysInMonth * rate;
  const hra = gross - basic;
  const employeePf = Math.round(basic * PF_RATE);
  const employerPf = Math.round(basic * PF_RATE);
  const esicApplies = gross <= ESIC_GROSS_CEILING;
  const employeeEsic = esicApplies ? Math.round(gross * ESIC_EMPLOYEE_RATE) : 0;
  const employerEsic = esicApplies ? Math.round(gross * ESIC_EMPLOYER_RATE) : 0;
  const salaryPayable = gross - employeePf - employeeEsic - salaryDeduction;
  const totalCtc = salary + petrol + employerPf + employerEsic;

  return { totalDays, rate, gross, hra, basic, employeePf, employerPf, employeeEsic, employerEsic, salaryDeduction, salaryPayable, totalCtc };
}

module.exports = { daysInCalendarMonth, computePayrollRow };
