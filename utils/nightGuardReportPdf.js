const PDFDocument = require("pdfkit");

const HEADER_FILL = "#4472C4";
const BORDER_COLOR = "#999999";
const HEADER_FONT_SIZE = 9;
const CELL_FONT_SIZE = 8;
const ROW_HEIGHT = 20;
const HEADER_HEIGHT = 22;
const MARGIN = 24;
const PAGE_HEIGHT = 780;

const COLUMNS = [
  { label: "Date", width: 75 },
  { label: "Site", width: 140 },
  { label: "Time", width: 75 },
  { label: "Status", width: 100 },
  { label: "Guard Name", width: 150 },
];

function drawHeaderRow(doc, x, y) {
  let cx = x;
  doc.font("Helvetica-Bold").fontSize(HEADER_FONT_SIZE);
  COLUMNS.forEach((col) => {
    doc.rect(cx, y, col.width, HEADER_HEIGHT).fillAndStroke(HEADER_FILL, BORDER_COLOR);
    doc.fillColor("#FFFFFF").text(col.label, cx + 4, y + HEADER_HEIGHT / 2 - 5, { width: col.width - 8, align: "center" });
    cx += col.width;
  });
}

function drawDataRow(doc, values, x, y) {
  let cx = x;
  doc.font("Helvetica").fontSize(CELL_FONT_SIZE);
  COLUMNS.forEach((col, idx) => {
    doc.rect(cx, y, col.width, ROW_HEIGHT).stroke(BORDER_COLOR);
    doc.fillColor("#000000").text(String(values[idx] ?? ""), cx + 4, y + ROW_HEIGHT / 2 - 4, { width: col.width - 8, align: "center" });
    cx += col.width;
  });
}

function buildNightGuardReportPdf(report, dateRangeLabel) {
  const totalWidth = COLUMNS.reduce((sum, c) => sum + c.width, 0) + MARGIN * 2;
  const pageSize = [totalWidth, PAGE_HEIGHT];
  const doc = new PDFDocument({ size: pageSize, margin: MARGIN });
  const bottomLimit = PAGE_HEIGHT - MARGIN;

  doc.font("Helvetica-Bold").fontSize(12).fillColor("#111827").text(`Night Guard Daily Report — ${dateRangeLabel}`, MARGIN, MARGIN - 10);

  let y = MARGIN + 20;
  drawHeaderRow(doc, MARGIN, y);
  y += HEADER_HEIGHT;

  report.entries.forEach((e) => {
    if (y + ROW_HEIGHT > bottomLimit) {
      doc.addPage({ size: pageSize, margin: MARGIN });
      y = MARGIN;
      drawHeaderRow(doc, MARGIN, y);
      y += HEADER_HEIGHT;
    }
    drawDataRow(doc, [e.date || report.reportDate, e.site, e.timeSlot, e.status, e.guardName], MARGIN, y);
    y += ROW_HEIGHT;
  });

  return doc;
}

module.exports = { buildNightGuardReportPdf };
