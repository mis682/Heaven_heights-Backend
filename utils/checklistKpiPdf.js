const PDFDocument = require("pdfkit");

// Shared KPI PDF layout, reused across every checklist module's weekly/
// date-range KPI export — mirrors the look of the existing report PDFs
// (reportPdf.js files) but with Total/OK/Not OK/OK% columns instead of a
// single status column.
const HEADER_FILL = "#4472C4";
const BORDER_COLOR = "#999999";
const HEADER_FONT_SIZE = 9;
const CELL_FONT_SIZE = 8;
const ROW_HEIGHT = 20;
const HEADER_HEIGHT = 22;
const MARGIN = 24;
const PAGE_HEIGHT = 780;

const COLUMNS = [
  { label: "Checkpoint / Staff", width: 220 },
  { label: "Total", width: 60 },
  { label: "OK", width: 60 },
  { label: "Not OK", width: 60 },
  { label: "OK %", width: 60 },
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
  doc.font("Helvetica").fontSize(CELL_FONT_SIZE).fillColor("#000000");
  values.forEach((val, idx) => {
    const width = COLUMNS[idx].width;
    doc.rect(cx, y, width, ROW_HEIGHT).stroke(BORDER_COLOR);
    doc.text(String(val ?? ""), cx + 4, y + ROW_HEIGHT / 2 - 4, { width: width - 8, align: "center" });
    cx += width;
  });
}

function buildChecklistKpiPdf(title, from, to, rows) {
  const totalWidth = COLUMNS.reduce((sum, c) => sum + c.width, 0) + MARGIN * 2;
  const pageSize = [totalWidth, PAGE_HEIGHT];
  const doc = new PDFDocument({ size: pageSize, margin: MARGIN });
  const bottomLimit = PAGE_HEIGHT - MARGIN;

  doc.font("Helvetica-Bold").fontSize(12).fillColor("#111827").text(`${title} — ${from} to ${to}`, MARGIN, MARGIN - 10);

  let y = MARGIN + 20;
  drawHeaderRow(doc, MARGIN, y);
  y += HEADER_HEIGHT;

  rows.forEach((r) => {
    if (y + ROW_HEIGHT > bottomLimit) {
      doc.addPage({ size: pageSize, margin: MARGIN });
      y = MARGIN;
      drawHeaderRow(doc, MARGIN, y);
      y += HEADER_HEIGHT;
    }
    drawDataRow(doc, [r.label, r.total, r.ok, r.notOk, `${r.okPercent}%`], MARGIN, y);
    y += ROW_HEIGHT;
  });

  return doc;
}

module.exports = { buildChecklistKpiPdf };
