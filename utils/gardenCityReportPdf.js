const PDFDocument = require("pdfkit");

const HEADER_FILL = "#4472C4";
const BORDER_COLOR = "#999999";
const HEADER_FONT_SIZE = 9;
const CELL_FONT_SIZE = 8;
const ROW_HEIGHT = 20;
const HEADER_HEIGHT = 22;
const MARGIN = 24;
const PAGE_HEIGHT = 780;

const BAND_COLORS = ["#F4B6AA", "#C7A6DD"];

const COLUMNS = [
  { label: "Checkpoint & Time", width: 170 },
  { label: "Guard Name", width: 150 },
  { label: "Date", width: 80 },
  { label: "Status", width: 100 },
];

function getBandColors(entries) {
  const colors = [];
  let blockIndex = 0;
  entries.forEach((e, idx) => {
    if (idx > 0 && e.time === "07:00:00 PM") blockIndex += 1;
    colors.push(BAND_COLORS[blockIndex % 2]);
  });
  return colors;
}

function drawHeaderRow(doc, x, y) {
  let cx = x;
  doc.font("Helvetica-Bold").fontSize(HEADER_FONT_SIZE);
  COLUMNS.forEach((col) => {
    doc.rect(cx, y, col.width, HEADER_HEIGHT).fillAndStroke(HEADER_FILL, BORDER_COLOR);
    doc.fillColor("#FFFFFF").text(col.label, cx + 4, y + HEADER_HEIGHT / 2 - 5, { width: col.width - 8, align: "center" });
    cx += col.width;
  });
}

function drawDataRow(doc, values, x, y, bandColor) {
  let cx = x;
  doc.font("Helvetica").fontSize(CELL_FONT_SIZE);
  COLUMNS.forEach((col, idx) => {
    if (idx === 0) {
      doc.rect(cx, y, col.width, ROW_HEIGHT).fillAndStroke(bandColor, BORDER_COLOR);
    } else {
      doc.rect(cx, y, col.width, ROW_HEIGHT).stroke(BORDER_COLOR);
    }
    doc.fillColor("#000000").text(String(values[idx] ?? ""), cx + 4, y + ROW_HEIGHT / 2 - 4, { width: col.width - 8, align: "center" });
    cx += col.width;
  });
}

function buildGardenCityReportPdf(report) {
  const totalWidth = COLUMNS.reduce((sum, c) => sum + c.width, 0) + MARGIN * 2;
  const pageSize = [totalWidth, PAGE_HEIGHT];
  const doc = new PDFDocument({ size: pageSize, margin: MARGIN });
  const bottomLimit = PAGE_HEIGHT - MARGIN;
  const bandColors = getBandColors(report.entries);

  doc.font("Helvetica-Bold").fontSize(12).fillColor("#111827").text(`Garden City Guard Checkpoint Report — ${report.reportDate}`, MARGIN, MARGIN - 10);

  let y = MARGIN + 20;
  drawHeaderRow(doc, MARGIN, y);
  y += HEADER_HEIGHT;

  report.entries.forEach((e, idx) => {
    if (y + ROW_HEIGHT > bottomLimit) {
      doc.addPage({ size: pageSize, margin: MARGIN });
      y = MARGIN;
      drawHeaderRow(doc, MARGIN, y);
      y += HEADER_HEIGHT;
    }
    drawDataRow(doc, [`${e.checkpointLabel} ${e.time}`, e.guardName || "—", report.reportDate, e.status || "—"], MARGIN, y, bandColors[idx]);
    y += ROW_HEIGHT;
  });

  return doc;
}

module.exports = { buildGardenCityReportPdf };
