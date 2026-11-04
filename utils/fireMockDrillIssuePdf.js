const PDFDocument = require("pdfkit");

// One-page summary generated at submission time — project/supervisor/date
// plus the 3 issue questions and whatever the submitter actually answered,
// uploaded to Drive right after the drill is created (see
// fireMockDrillController.js's create). Matches the house style used by the
// other card-style report PDFs (nightGuardReportPdf.js etc.).
const CARD_NAVY = "#1e3550";
const CARD_INK = "#24292b";
const CARD_INK_SOFT = "#5b6265";
const CARD_BAD = "#a83a2a";
const CARD_GOOD = "#1a7a3c";

function drawField(doc, label, value, { color } = {}) {
  doc.font("Helvetica-Bold").fontSize(10.5).fillColor(CARD_INK).text(label);
  doc.font("Helvetica").fontSize(10.5).fillColor(color || CARD_INK_SOFT).text(value || "—", { width: 500 });
  doc.moveDown(0.7);
}

function buildFireMockDrillIssuePdf(drill) {
  const doc = new PDFDocument({ size: "A4", margin: 48 });

  doc.font("Helvetica-Bold").fontSize(16).fillColor(CARD_NAVY).text("Fire Mock Drill — Issue Report");
  doc.moveDown(0.2);
  doc.font("Helvetica").fontSize(9).fillColor(CARD_INK_SOFT).text("Submitted via the Fire Mock Drill public form");
  doc.moveDown(1);

  drawField(doc, "Project", drill.projectName);
  drawField(doc, "Maintenance Supervisor", drill.maintenanceSupervisor);
  drawField(doc, "Date", drill.date);

  doc.moveDown(0.3);
  doc.strokeColor("#D1D5DB").moveTo(doc.x, doc.y).lineTo(547, doc.y).stroke();
  doc.moveDown(1);

  drawField(doc, "During the drill, was any issue or unsafe condition identified?", drill.issueIdentified, {
    color: drill.issueIdentified === "Yes" ? CARD_BAD : CARD_GOOD,
  });
  drawField(doc, "Please describe the issue or unsafe condition and where it was found.", drill.issueDescription);
  drawField(doc, "What action did the team take, or what action plan was agreed upon?", drill.actionTaken);

  return doc;
}

module.exports = { buildFireMockDrillIssuePdf };
