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
  { label: "Checkpoint", width: 130 },
  { label: "Status", width: 150 }, // header text is overridden with the report's date at draw time
];

function drawHeaderRow(doc, x, y, dateLabel) {
  let cx = x;
  doc.font("Helvetica-Bold").fontSize(HEADER_FONT_SIZE);
  [COLUMNS[0].label, dateLabel].forEach((label, idx) => {
    const width = COLUMNS[idx].width;
    doc.rect(cx, y, width, HEADER_HEIGHT).fillAndStroke(HEADER_FILL, BORDER_COLOR);
    doc.fillColor("#FFFFFF").text(label, cx + 4, y + HEADER_HEIGHT / 2 - 5, { width: width - 8, align: "center" });
    cx += width;
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

function buildGCHousekeepingReportPdf(report) {
  const totalWidth = COLUMNS.reduce((sum, c) => sum + c.width, 0) + MARGIN * 2;
  const pageSize = [totalWidth, PAGE_HEIGHT];
  const doc = new PDFDocument({ size: pageSize, margin: MARGIN });
  const bottomLimit = PAGE_HEIGHT - MARGIN;

  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor("#111827")
    .text(`Garden City Housekeeping Report — ${report.reportDate}`, MARGIN, MARGIN - 10);

  let y = MARGIN + 20;
  drawHeaderRow(doc, MARGIN, y, report.reportDate);
  y += HEADER_HEIGHT;

  report.entries.forEach((e) => {
    if (y + ROW_HEIGHT > bottomLimit) {
      doc.addPage({ size: pageSize, margin: MARGIN });
      y = MARGIN;
      drawHeaderRow(doc, MARGIN, y, report.reportDate);
      y += HEADER_HEIGHT;
    }
    drawDataRow(doc, [`Checkpoint-${e.checkpointId}`, e.status || "—"], MARGIN, y);
    y += ROW_HEIGHT;
  });

  return doc;
}

module.exports = { buildGCHousekeepingReportPdf };
