const PDFDocument = require("pdfkit");

const HEADER_FILL = "#4472C4";
const BORDER_COLOR = "#999999";
const HEADER_FONT_SIZE = 8;
const CELL_FONT_SIZE = 7;
const ROW_HEIGHT = 22;
const HEADER_HEIGHT = 24;
const MARGIN = 20;
const PAGE_HEIGHT = 595;

function buildColumns(checkpointCount) {
  const fixed = [
    { label: "Date", width: 65 },
    { label: "Guard Name", width: 120 },
    { label: "Time", width: 105 },
    { label: "Checkpoint", width: 75 },
  ];
  const checkpointCols = Array.from({ length: checkpointCount }, (_, i) => ({
    label: `Checkpoint-${i + 1}`,
    width: 72,
  }));
  return [...fixed, ...checkpointCols];
}

function drawHeaderRow(doc, columns, x, y) {
  let cx = x;
  doc.font("Helvetica-Bold").fontSize(HEADER_FONT_SIZE);
  columns.forEach((col) => {
    doc.rect(cx, y, col.width, HEADER_HEIGHT).fillAndStroke(HEADER_FILL, BORDER_COLOR);
    doc
      .fillColor("#FFFFFF")
      .text(col.label, cx + 2, y + HEADER_HEIGHT / 2 - 5, { width: col.width - 4, align: "center" });
    cx += col.width;
  });
}

function drawDataRow(doc, columns, values, x, y) {
  let cx = x;
  doc.font("Helvetica").fontSize(CELL_FONT_SIZE);
  columns.forEach((col, idx) => {
    doc.rect(cx, y, col.width, ROW_HEIGHT).stroke(BORDER_COLOR);
    doc
      .fillColor("#000000")
      .text(String(values[idx] ?? ""), cx + 2, y + ROW_HEIGHT / 2 - 4, { width: col.width - 4, align: "center" });
    cx += col.width;
  });
}

function buildCheckpointReportPdf(report) {
  const columns = buildColumns(report.checkpointCount);
  const totalWidth = columns.reduce((sum, c) => sum + c.width, 0) + MARGIN * 2;
  const pageSize = [totalWidth, PAGE_HEIGHT];

  const doc = new PDFDocument({ size: pageSize, margin: MARGIN });
  const checkpointRange = report.checkpointCount > 0 ? `C1 TO C${report.checkpointCount}` : "";
  const bottomLimit = PAGE_HEIGHT - MARGIN;

  let y = MARGIN;
  drawHeaderRow(doc, columns, MARGIN, y);
  y += HEADER_HEIGHT;

  report.entries.forEach((entry) => {
    if (y + ROW_HEIGHT > bottomLimit) {
      doc.addPage({ size: pageSize, margin: MARGIN });
      y = MARGIN;
      drawHeaderRow(doc, columns, MARGIN, y);
      y += HEADER_HEIGHT;
    }
    const values = [
      entry.date || report.reportDate,
      entry.guardName,
      entry.timeSlot,
      checkpointRange,
      ...entry.checkpointStatuses.map((s) => s || "—"),
    ];
    drawDataRow(doc, columns, values, MARGIN, y);
    y += ROW_HEIGHT;
  });

  return doc;
}

module.exports = { buildCheckpointReportPdf };
