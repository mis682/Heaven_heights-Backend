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

const CARD_NAVY = "#1e3550";
const CARD_INK = "#24292b";
const CARD_INK_SOFT = "#5b6265";
const CARD_BAD = "#a83a2a";
const CARD_BAD_BG = "#fbe7e4";
const CARD_NEUTRAL_BG = "#e8e8e3";

// Mirrors the on-screen Card view (PatrolAdminReportPage.jsx's groupByGuard):
// one block per guard with a header bar, then each visit's non-empty
// checkpoint statuses on their own line — same grouping as the screen, just
// a list instead of flex-wrapped chips (more reliable to lay out in pdfkit).
function groupByGuard(entries) {
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
    const visits = byGuard.get(guardName);
    let presentCount = 0;
    let total = 0;
    visits.forEach((v) => {
      v.checkpointStatuses.forEach((s) => {
        if (!s) return;
        total += 1;
        if (s === "Present") presentCount += 1;
      });
    });
    return { guardName, visits, presentCount, total };
  });
}

function buildCheckpointReportPdfCard(report) {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const bottomLimit = doc.page.height - doc.page.margins.bottom;
  const left = doc.page.margins.left;

  const guards = groupByGuard(report.entries);
  const overallTotal = guards.reduce((sum, g) => sum + g.total, 0);
  const overallPresent = guards.reduce((sum, g) => sum + g.presentCount, 0);
  const overallFlagged = overallTotal - overallPresent;

  doc.font("Helvetica-Bold").fontSize(16).fillColor(CARD_NAVY).text(report.projectName || "Patrol Report");
  doc.moveDown(0.2);
  doc.font("Helvetica").fontSize(9).fillColor(CARD_INK_SOFT).text("Security · Patrol Checkpoint Report — read-only admin view");
  doc.moveDown(0.8);

  doc.font("Helvetica-Bold").fontSize(10.5).fillColor(overallFlagged > 0 ? CARD_BAD : CARD_INK);
  doc.text(`${overallPresent}/${overallTotal} Present   ·   ${overallFlagged} flagged   ·   ${guards.length} guards on duty`);
  doc.moveDown(1);

  guards.forEach((guard) => {
    const headerHeight = 22;
    const estimatedHeight = headerHeight + guard.visits.length * 13 + 12;
    if (doc.y + estimatedHeight > bottomLimit) doc.addPage();

    const guardFlagged = guard.total - guard.presentCount;
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

    doc.font("Helvetica").fontSize(8.5);
    guard.visits.forEach((v) => {
      const chips = v.checkpointStatuses
        .map((status, idx) => (status ? `C${idx + 1}: ${status}` : null))
        .filter(Boolean);
      if (chips.length === 0) return;
      const label = `${v.date} ${v.timeSlot}   —   ${chips.join("   ")}`;
      const lineHeight = doc.heightOfString(label, { width: contentWidth - 24 }) + 6;
      if (doc.y + lineHeight > bottomLimit) {
        doc.addPage();
        doc.x = left;
        doc.y = doc.page.margins.top;
      }
      const flagged = v.checkpointStatuses.some((s) => s && s !== "Present");
      doc.fillColor(flagged ? CARD_BAD : CARD_INK_SOFT);
      doc.text(label, left + 12, doc.y, { width: contentWidth - 24 });
      doc.moveDown(0.25);
    });

    doc.moveDown(0.6);
  });

  return doc;
}

module.exports = { buildCheckpointReportPdf, buildCheckpointReportPdfCard };
