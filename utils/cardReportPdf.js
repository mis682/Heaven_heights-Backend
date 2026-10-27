const PDFDocument = require("pdfkit");

// Shared "Card view" PDF layout, reused across every checklist module's
// Admin Report View modal — mirrors the on-screen card grid (see
// MilestoneAdminReportPage.jsx lines 156-174): a grid of small cards, one
// per checkpoint, 3 per row, with a red-tinted border/fill on "flagged"
// checkpoints (status set but not the module's "good" status).
const HEADER_FILL = "#4472C4";
const BORDER_COLOR = "#999999";
const FLAGGED_BORDER = "#FECACA";
const FLAGGED_FILL = "#FEF2F2";
const MARGIN = 24;
const PAGE_WIDTH = 24 + 190 * 3 + 24; // margin + 3 cards + margin
const PAGE_HEIGHT = 780;

const CARD_WIDTH = 190;
const CARD_HEIGHT = 70;
const CARD_GAP = 10;
const CARDS_PER_ROW = 3;

function drawTitle(doc, title) {
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#111827").text(title, MARGIN, MARGIN - 10, {
    width: PAGE_WIDTH - MARGIN * 2,
  });
}

function drawCard(doc, x, y, entry, goodStatus) {
  const status = entry?.status;
  const isGood = status === goodStatus;
  const flagged = Boolean(status) && !isGood;

  const borderColor = flagged ? FLAGGED_BORDER : BORDER_COLOR;
  const fillColor = flagged ? FLAGGED_FILL : "#FFFFFF";

  doc.rect(x, y, CARD_WIDTH, CARD_HEIGHT).fillAndStroke(fillColor, borderColor);

  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor("#111827")
    .text(entry?.checkpointLabel || "", x + 8, y + 8, { width: CARD_WIDTH - 16 });

  if (status) {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(flagged ? "#B91C1C" : "#374151")
      .text(String(status), x + 8, y + CARD_HEIGHT - 22, { width: CARD_WIDTH - 16 });
  } else {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#9CA3AF")
      .text("—", x + 8, y + CARD_HEIGHT - 22, { width: CARD_WIDTH - 16 });
  }
}

function buildCardReportPdf({ title, entries, goodStatus }) {
  const pageSize = [PAGE_WIDTH, PAGE_HEIGHT];
  const doc = new PDFDocument({ size: pageSize, margin: MARGIN });
  const bottomLimit = PAGE_HEIGHT - MARGIN;

  drawTitle(doc, title);

  let y = MARGIN + 20;
  let col = 0;

  (entries || []).forEach((entry) => {
    if (col === 0 && y + CARD_HEIGHT > bottomLimit) {
      doc.addPage({ size: pageSize, margin: MARGIN });
      y = MARGIN + 20;
      drawTitle(doc, title);
    }

    const x = MARGIN + col * (CARD_WIDTH + CARD_GAP);
    drawCard(doc, x, y, entry, goodStatus);

    col += 1;
    if (col >= CARDS_PER_ROW) {
      col = 0;
      y += CARD_HEIGHT + CARD_GAP;
    }
  });

  return doc;
}

module.exports = { buildCardReportPdf };
