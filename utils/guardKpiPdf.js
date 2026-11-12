const PDFDocument = require("pdfkit");

// Guard KPI PDF — same visual language as checklistKpiPdf.js (bordered
// table, blue header fill) but for the On Time/Late/Missed shape used by
// Patrol/Garden City Patrol/Night Guard's Guard KPI pages, plus the same 4
// summary boxes (Total/On Time/Late/Missed) shown on screen at the top.
const HEADER_FILL = "#4472C4";
const BORDER_COLOR = "#999999";
const HEADER_FONT_SIZE = 9;
const CELL_FONT_SIZE = 8;
const ROW_HEIGHT = 20;
const HEADER_HEIGHT = 22;
const MARGIN = 24;
const PAGE_HEIGHT = 780;

const COLUMNS = [
  { label: "Guard Name", width: 180 },
  { label: "Total", width: 55 },
  { label: "On Time", width: 55 },
  { label: "Late", width: 55 },
  { label: "Missed", width: 55 },
  { label: "On-Time %", width: 60 },
];

const SUMMARY_BOX_GAP = 8;

function drawSummaryBoxes(doc, x, y, width, totals) {
  const boxWidth = (width - SUMMARY_BOX_GAP * 3) / 4;
  const boxHeight = 48;
  const boxes = [
    { label: "TOTAL CHECKPOINTS", value: String(totals.total), color: "#111827" },
    { label: "ON TIME", value: String(totals.onTime), color: "#15803d" },
    { label: "LATE", value: `${totals.late} (${totals.latePercent > 0 ? "-" : ""}${totals.latePercent.toFixed(1)}%)`, color: "#b45309" },
    { label: "MISSED", value: `${totals.noPhoto} (${totals.missedPercent > 0 ? "-" : ""}${totals.missedPercent.toFixed(1)}%)`, color: "#b91c1c" },
  ];

  let cx = x;
  boxes.forEach((box) => {
    doc.rect(cx, y, boxWidth, boxHeight).stroke(BORDER_COLOR);
    doc
      .font("Helvetica-Bold")
      .fontSize(7)
      .fillColor("#6b7280")
      .text(box.label, cx + 6, y + 8, { width: boxWidth - 12 });
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor(box.color)
      .text(box.value, cx + 6, y + 22, { width: boxWidth - 12 });
    cx += boxWidth + SUMMARY_BOX_GAP;
  });

  return y + boxHeight + 16;
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

// `rows` is the same per-guard array the KPI page renders (guardName,
// total, onTime, late, noPhoto, onTimePercent) — `totals` is the summed
// totals across all rows, same shape the page's 4 summary cards use.
function buildGuardKpiPdf(title, from, to, rows, totals) {
  const tableWidth = COLUMNS.reduce((sum, c) => sum + c.width, 0);
  const totalWidth = tableWidth + MARGIN * 2;
  const pageSize = [totalWidth, PAGE_HEIGHT];
  const doc = new PDFDocument({ size: pageSize, margin: MARGIN });
  const bottomLimit = PAGE_HEIGHT - MARGIN;

  doc.font("Helvetica-Bold").fontSize(12).fillColor("#111827").text(`${title} — ${from} to ${to}`, MARGIN, MARGIN - 10);

  let y = MARGIN + 20;
  y = drawSummaryBoxes(doc, MARGIN, y, tableWidth, totals);

  drawHeaderRow(doc, MARGIN, y);
  y += HEADER_HEIGHT;

  rows.forEach((r) => {
    if (y + ROW_HEIGHT > bottomLimit) {
      doc.addPage({ size: pageSize, margin: MARGIN });
      y = MARGIN;
      drawHeaderRow(doc, MARGIN, y);
      y += HEADER_HEIGHT;
    }
    drawDataRow(doc, [r.guardName, r.total, r.onTime, r.late, r.noPhoto, `${r.onTimePercent}%`], MARGIN, y);
    y += ROW_HEIGHT;
  });

  return doc;
}

module.exports = { buildGuardKpiPdf };
