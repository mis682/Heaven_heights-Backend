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

const CARD_NAVY = "#1e3550";
const CARD_INK = "#24292b";
const CARD_INK_SOFT = "#5b6265";
const CARD_BAD = "#a83a2a";
const CARD_BAD_BG = "#fbe7e4";
const CARD_NEUTRAL_BG = "#e8e8e3";

// Mirrors the on-screen Card view (NightGuardAdminReportPage.jsx's
// groupByGuard): one block per guard with a header bar, then each visit on
// its own line — same grouping as the screen, just a list instead of
// flex-wrapped chips (more reliable to lay out in pdfkit).
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
    const presentCount = visits.filter((v) => v.status === "Present").length;
    return { guardName, visits, presentCount, total: visits.length };
  });
}

function buildNightGuardReportPdfCard(report, dateRangeLabel) {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const bottomLimit = doc.page.height - doc.page.margins.bottom;
  const left = doc.page.margins.left;

  const entries = report.entries;
  const total = entries.length;
  const presentCount = entries.filter((e) => e.status === "Present").length;
  const flaggedCount = total - presentCount;
  const guards = groupByGuard(entries);

  doc.font("Helvetica-Bold").fontSize(16).fillColor(CARD_NAVY).text(`Night Guard — ${dateRangeLabel}`);
  doc.moveDown(0.2);
  doc.font("Helvetica").fontSize(9).fillColor(CARD_INK_SOFT).text("Security · Night Guard Report — read-only admin view");
  doc.moveDown(0.8);

  doc.font("Helvetica-Bold").fontSize(10.5).fillColor(flaggedCount > 0 ? CARD_BAD : CARD_INK);
  doc.text(`${presentCount}/${total} Present   ·   ${flaggedCount} flagged   ·   ${guards.length} guards on duty`);
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
      const lineHeight = 13;
      if (doc.y + lineHeight > bottomLimit) {
        doc.addPage();
        doc.x = left;
        doc.y = doc.page.margins.top;
      }
      const flagged = v.status !== "Present";
      const label = `${v.date || report.reportDate} · ${v.site} · ${v.timeSlot}${flagged ? ` — ${v.status || "—"}` : ""}`;
      doc.fillColor(flagged ? CARD_BAD : CARD_INK_SOFT);
      doc.text(label, left + 12, doc.y, { width: contentWidth - 24 });
      doc.moveDown(0.15);
    });

    doc.moveDown(0.6);
  });

  return doc;
}

module.exports = { buildNightGuardReportPdf, buildNightGuardReportPdfCard };
