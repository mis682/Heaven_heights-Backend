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

const CARD_NAVY = "#1e3550";
const CARD_INK = "#24292b";
const CARD_INK_SOFT = "#5b6265";
const CARD_BAD = "#a83a2a";
const CARD_BAD_BG = "#fbe7e4";
const CARD_NEUTRAL_BG = "#e8e8e3";

// Groups a flat entry list into guard -> checkpoint -> [visits], preserving
// first-appearance order (not sorted) so it matches the order coordinators
// actually logged things in, same as the classic export.
function groupByGuardThenCheckpoint(entries) {
  const guardOrder = [];
  const byGuard = new Map();
  entries.forEach((e) => {
    const name = e.guardName || "Unassigned";
    if (!byGuard.has(name)) {
      byGuard.set(name, []);
      guardOrder.push(name);
    }
    byGuard.get(name).push(e);
  });

  return guardOrder.map((guardName) => {
    const guardEntries = byGuard.get(guardName);
    const cpOrder = [];
    const byCheckpoint = new Map();
    guardEntries.forEach((e) => {
      if (!byCheckpoint.has(e.checkpointLabel)) {
        byCheckpoint.set(e.checkpointLabel, []);
        cpOrder.push(e.checkpointLabel);
      }
      byCheckpoint.get(e.checkpointLabel).push(e);
    });
    const presentCount = guardEntries.filter((e) => e.status === "Present").length;
    return {
      guardName,
      total: guardEntries.length,
      presentCount,
      checkpoints: cpOrder.map((label) => ({ label, visits: byCheckpoint.get(label) })),
    };
  });
}

// Same underlying data as buildGardenCityReportPdf, grouped by guard then by
// checkpoint instead of one flat repeating-row table — each checkpoint's
// scan times collapse onto a single line instead of a separate row per scan.
function buildGardenCityReportPdfCard(report) {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const bottomLimit = doc.page.height - doc.page.margins.bottom;

  const entries = report.entries;
  const total = entries.length;
  const presentCount = entries.filter((e) => e.status === "Present").length;
  const flaggedCount = total - presentCount;
  const guards = groupByGuardThenCheckpoint(entries);

  doc.font("Helvetica-Bold").fontSize(16).fillColor(CARD_NAVY).text(`Garden City — ${report.reportDate}`);
  doc.moveDown(0.2);
  doc.font("Helvetica").fontSize(9).fillColor(CARD_INK_SOFT).text("Security · Garden City Checkpoint Report — read-only admin view");
  doc.moveDown(0.8);

  doc.font("Helvetica-Bold").fontSize(10.5).fillColor(flaggedCount > 0 ? CARD_BAD : CARD_INK);
  doc.text(`${presentCount}/${total} scans Present   ·   ${flaggedCount} flagged   ·   ${guards.length} guards on duty`);
  doc.moveDown(1);

  const left = doc.page.margins.left;

  guards.forEach((guard) => {
    const guardFlagged = guard.total - guard.presentCount;
    const headerHeight = 22;
    const estimatedHeight = headerHeight + guard.checkpoints.length * 14 + 12;
    if (doc.y + estimatedHeight > bottomLimit) doc.addPage();

    const barY = doc.y;
    doc.rect(left, barY, contentWidth, headerHeight).fill(guardFlagged > 0 ? CARD_BAD_BG : CARD_NEUTRAL_BG);
    doc
      .fillColor(guardFlagged > 0 ? CARD_BAD : CARD_INK)
      .font("Helvetica-Bold")
      .fontSize(10.5)
      .text(guard.guardName, left + 8, barY + 6, { lineBreak: false });
    doc
      .fillColor(CARD_INK_SOFT)
      .font("Helvetica")
      .fontSize(8.5)
      .text(`${guard.presentCount} / ${guard.total} Present`, left, barY + 7, { width: contentWidth - 10, align: "right", lineBreak: false });
    doc.x = left;
    doc.y = barY + headerHeight + 6;

    // One line per checkpoint (label + all its scan times) instead of a
    // continued-text chain — pdfkit's continued mode wraps the whole chain
    // inside the FIRST segment's width, which broke badly with a narrow
    // label column; a single string avoids that entirely and still wraps
    // cleanly on its own if a checkpoint has many visits.
    doc.font("Helvetica").fontSize(8.5);
    guard.checkpoints.forEach((cp) => {
      const lineHeight = doc.heightOfString(cp.label, { width: contentWidth - 24 }) + 6;
      if (doc.y + lineHeight > bottomLimit) {
        doc.addPage();
        doc.x = left;
        doc.y = doc.page.margins.top;
      }
      const hasIssue = cp.visits.some((v) => v.status !== "Present");
      const timesText = cp.visits.map((v) => (v.status === "Present" ? v.time : `${v.time} (${v.status})`)).join("   ");
      doc.fillColor(hasIssue ? CARD_BAD : CARD_INK_SOFT);
      doc.text(`${cp.label}:   ${timesText}`, left + 12, doc.y, { width: contentWidth - 24 });
      doc.moveDown(0.25);
    });

    doc.moveDown(0.6);
  });

  return doc;
}

module.exports = { buildGardenCityReportPdf, buildGardenCityReportPdfCard };
