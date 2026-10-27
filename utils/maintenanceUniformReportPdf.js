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
  { label: "Designation", width: 110 },
  { label: "Staff Name", width: 160 },
  { label: "Site Name", width: 140 },
  { label: "Status", width: 120 }, // header text is overridden with the report's date at draw time
];

function drawHeaderRow(doc, x, y, dateLabel) {
  let cx = x;
  doc.font("Helvetica-Bold").fontSize(HEADER_FONT_SIZE);
  [COLUMNS[0].label, COLUMNS[1].label, COLUMNS[2].label, dateLabel].forEach((label, idx) => {
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

function buildMaintenanceUniformReportPdf(report) {
  const totalWidth = COLUMNS.reduce((sum, c) => sum + c.width, 0) + MARGIN * 2;
  const pageSize = [totalWidth, PAGE_HEIGHT];
  const doc = new PDFDocument({ size: pageSize, margin: MARGIN });
  const bottomLimit = PAGE_HEIGHT - MARGIN;
  const title = `Maintenance Uniform${report.reportName ? ` — ${report.reportName}` : ""} — ${report.reportDate}`;

  doc.font("Helvetica-Bold").fontSize(12).fillColor("#111827").text(title, MARGIN, MARGIN - 10);

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
    drawDataRow(doc, [e.designation, e.staffName, e.siteName, e.status || "—"], MARGIN, y);
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

// Mirrors the on-screen Card view (MaintenanceUniformAdminReportPage.jsx's
// groupedEntries): one block per designation with a header bar, then each
// staff member on its own line — same grouping as the screen and as
// Classic, just staff-per-line instead of a staff-card grid (more reliable
// to lay out in pdfkit than a true grid).
function groupedEntries(entries) {
  const groups = [];
  for (const e of entries) {
    const last = groups[groups.length - 1];
    if (last && last.designation === e.designation) last.rows.push(e);
    else groups.push({ designation: e.designation, rows: [e] });
  }
  return groups;
}

function buildMaintenanceUniformReportPdfCard(report) {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const bottomLimit = doc.page.height - doc.page.margins.bottom;
  const left = doc.page.margins.left;

  const groups = groupedEntries(report.entries);
  const overallTotal = report.entries.length;
  const overallOk = report.entries.filter((e) => e.status === "OK").length;
  const overallFlagged = overallTotal - overallOk;

  const title = `Maintenance Uniform${report.reportName ? ` — ${report.reportName}` : ""} — ${report.reportDate}`;
  doc.font("Helvetica-Bold").fontSize(16).fillColor(CARD_NAVY).text(title);
  doc.moveDown(0.2);
  doc.font("Helvetica").fontSize(9).fillColor(CARD_INK_SOFT).text("Maintenance Uniform Report — read-only admin view");
  doc.moveDown(0.8);

  doc.font("Helvetica-Bold").fontSize(10.5).fillColor(overallFlagged > 0 ? CARD_BAD : CARD_INK);
  doc.text(`${overallOk}/${overallTotal} OK   ·   ${overallFlagged} flagged   ·   ${groups.length} designations`);
  doc.moveDown(1);

  groups.forEach((group) => {
    const headerHeight = 22;
    const estimatedHeight = headerHeight + group.rows.length * 13 + 12;
    if (doc.y + estimatedHeight > bottomLimit) doc.addPage();

    const okCount = group.rows.filter((r) => r.status === "OK").length;
    const groupFlagged = group.rows.length - okCount;
    const barY = doc.y;
    doc.rect(left, barY, contentWidth, headerHeight).fill(groupFlagged > 0 ? CARD_BAD_BG : CARD_NEUTRAL_BG);
    doc
      .fillColor(groupFlagged > 0 ? CARD_BAD : CARD_INK)
      .font("Helvetica-Bold")
      .fontSize(10.5)
      .text(group.designation, left + 8, barY + 6, { lineBreak: false });
    doc
      .fillColor(CARD_INK_SOFT)
      .font("Helvetica")
      .fontSize(8.5)
      .text(`${okCount} / ${group.rows.length} OK`, left, barY + 7, { width: contentWidth - 10, align: "right", lineBreak: false });
    doc.x = left;
    doc.y = barY + headerHeight + 6;

    doc.font("Helvetica").fontSize(8.5);
    group.rows.forEach((e) => {
      const lineHeight = 13;
      if (doc.y + lineHeight > bottomLimit) {
        doc.addPage();
        doc.x = left;
        doc.y = doc.page.margins.top;
      }
      const flagged = e.status && e.status !== "OK";
      const label = `${e.staffName} — ${e.siteName} — ${e.status || "—"}`;
      doc.fillColor(flagged ? CARD_BAD : CARD_INK_SOFT);
      doc.text(label, left + 12, doc.y, { width: contentWidth - 24 });
      doc.moveDown(0.15);
    });

    doc.moveDown(0.6);
  });

  return doc;
}

module.exports = { buildMaintenanceUniformReportPdf, buildMaintenanceUniformReportPdfCard };
