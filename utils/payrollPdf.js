const PDFDocument = require("pdfkit");

// Same bordered-table visual language as the other report PDFs in this
// codebase (checklistKpiPdf.js, guardKpiPdf.js) — a custom-width page sized
// to fit every column rather than a fixed A4/Letter, since this sheet has
// far more columns than a portrait page could ever hold. Font is small (7pt)
// by necessity; this PDF is meant as a quick view/print, not the final
// document — HR builds their actual salary sheet off the Excel export.
const HEADER_FILL = "#4472C4";
const BORDER_COLOR = "#999999";
const HEADER_FONT_SIZE = 6.5;
const CELL_FONT_SIZE = 6.5;
const ROW_HEIGHT = 14;
const HEADER_HEIGHT = 24;
const MARGIN = 20;
const PAGE_HEIGHT = 700;

const COLUMNS = [
  { key: "sNo", label: "S No", width: 20 },
  { key: "siteName", label: "Site Name", width: 55 },
  { key: "employeeName", label: "Employee Name", width: 80 },
  { key: "employeeId", label: "E.ID", width: 32 },
  { key: "designation", label: "Designation", width: 55 },
  { key: "bankAccountNo", label: "Bank A/C No.", width: 65 },
  { key: "bankIfscCode", label: "IFSC", width: 45 },
  { key: "salary", label: "Salary", width: 38 },
  { key: "petrol", label: "Petrol", width: 32 },
  { key: "daysInMonth", label: "Days", width: 24 },
  { key: "presentDays", label: "Present", width: 32 },
  { key: "leaveAllowed", label: "Leave", width: 28 },
  { key: "overTime", label: "OT", width: 24 },
  { key: "totalDays", label: "Tot.Days", width: 32 },
  { key: "rate", label: "Rate", width: 28 },
  { key: "gross", label: "Gross", width: 40 },
  { key: "hra", label: "HRA", width: 36 },
  { key: "basic", label: "Basic", width: 34 },
  { key: "employeePf", label: "Emp.PF", width: 32 },
  { key: "employerPf", label: "Er.PF", width: 32 },
  { key: "employeeEsic", label: "Emp.ESIC", width: 34 },
  { key: "employerEsic", label: "Er.ESIC", width: 34 },
  { key: "salaryDeduction", label: "Deduct.", width: 34 },
  { key: "salaryPayable", label: "Payable", width: 40 },
  { key: "totalCtc", label: "Total CTC", width: 42 },
  { key: "uanNumber", label: "UAN", width: 55 },
  { key: "esicNumber", label: "ESIC No.", width: 50 },
  { key: "aadharNumber", label: "Aadhar", width: 55 },
];

function drawHeaderRow(doc, x, y) {
  let cx = x;
  doc.font("Helvetica-Bold").fontSize(HEADER_FONT_SIZE);
  COLUMNS.forEach((col) => {
    doc.rect(cx, y, col.width, HEADER_HEIGHT).fillAndStroke(HEADER_FILL, BORDER_COLOR);
    doc.fillColor("#FFFFFF").text(col.label, cx + 2, y + HEADER_HEIGHT / 2 - 5, { width: col.width - 4, align: "center" });
    cx += col.width;
  });
}

function drawRow(doc, x, y, row, { bold = false } = {}) {
  let cx = x;
  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(CELL_FONT_SIZE).fillColor("#000000");
  COLUMNS.forEach((col) => {
    doc.rect(cx, y, col.width, ROW_HEIGHT).stroke(BORDER_COLOR);
    const val = row[col.key];
    doc.text(val === undefined || val === null || val === "" ? "" : String(val), cx + 2, y + ROW_HEIGHT / 2 - 4, {
      width: col.width - 4,
      align: "center",
    });
    cx += col.width;
  });
}

function buildPayrollPdf(payroll, title) {
  const tableWidth = COLUMNS.reduce((sum, c) => sum + c.width, 0);
  const pageSize = [tableWidth + MARGIN * 2, PAGE_HEIGHT];
  const doc = new PDFDocument({ size: pageSize, margin: MARGIN });
  const bottomLimit = PAGE_HEIGHT - MARGIN;

  doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827").text(title, MARGIN, MARGIN - 12);

  let y = MARGIN + 14;
  drawHeaderRow(doc, MARGIN, y);
  y += HEADER_HEIGHT;

  const ensureSpace = () => {
    if (y + ROW_HEIGHT > bottomLimit) {
      doc.addPage({ size: pageSize, margin: MARGIN });
      y = MARGIN;
      drawHeaderRow(doc, MARGIN, y);
      y += HEADER_HEIGHT;
    }
  };

  payroll.siteGroups.forEach((group) => {
    group.rows.forEach((r) => {
      ensureSpace();
      drawRow(doc, MARGIN, y, r);
      y += ROW_HEIGHT;
    });
    ensureSpace();
    drawRow(doc, MARGIN, y, { employeeName: `Total — ${group.siteName}`, ...group.subtotal }, { bold: true });
    y += ROW_HEIGHT;
  });

  if (payroll.grandTotal) {
    ensureSpace();
    drawRow(doc, MARGIN, y, { employeeName: `Total Amount of ${payroll.company} Salary`, ...payroll.grandTotal }, { bold: true });
    y += ROW_HEIGHT;
  }

  return doc;
}

module.exports = { buildPayrollPdf };
