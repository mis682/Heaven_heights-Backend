const PDFDocument = require("pdfkit");

const STATUS_COLORS = { P: "#22c55e", A: "#ef4444", HD: "#3b82f6", SP: "#f59e0b" };
const HEADER_FILL = "#374151";
const BORDER_COLOR = "#d1d5db";
const MARGIN = 20;
const ROW_HEIGHT = 16;
const HEADER_HEIGHT = 20;
const TITLE_HEIGHT = 22;
const PAGE_HEIGHT = 620;

function buildColumns(daysInMonth) {
  const fixed = [
    { label: "Name", width: 100, key: "name" },
    { label: "Emp ID", width: 50, key: "employeeId" },
    { label: "Site", width: 85, key: "siteName" },
    { label: "Present%", width: 40, key: "presentPercent" },
    { label: "Tot. P", width: 30, key: "totalPresent" },
    { label: "Tot. A", width: 30, key: "totalAbsent" },
    { label: "Tot. HD", width: 32, key: "totalHalfDay" },
    { label: "Tot. SP", width: 32, key: "totalSinglePunch" },
  ];
  const dayCols = Array.from({ length: daysInMonth }, (_, i) => ({ label: String(i + 1), width: 17, key: `day${i + 1}` }));
  return [...fixed, ...dayCols];
}

function drawHeaderRow(doc, columns, x, y) {
  let cx = x;
  doc.font("Helvetica-Bold").fontSize(7);
  columns.forEach((col) => {
    doc.rect(cx, y, col.width, HEADER_HEIGHT).fillAndStroke(HEADER_FILL, BORDER_COLOR);
    doc.fillColor("#FFFFFF").text(col.label, cx + 1, y + HEADER_HEIGHT / 2 - 4, { width: col.width - 2, align: "center" });
    cx += col.width;
  });
}

function drawDataRow(doc, columns, row, x, y) {
  let cx = x;
  doc.font("Helvetica").fontSize(6.5);
  columns.forEach((col) => {
    let text = "";
    let fill = "#ffffff";
    if (col.key === "name") text = row.name;
    else if (col.key === "employeeId") text = row.employeeId;
    else if (col.key === "siteName") text = row.siteName;
    else if (col.key === "presentPercent") text = `${row.presentPercent}%`;
    else if (col.key === "totalPresent") text = String(row.totalPresent);
    else if (col.key === "totalAbsent") text = String(row.totalAbsent);
    else if (col.key === "totalHalfDay") text = String(row.totalHalfDay);
    else if (col.key === "totalSinglePunch") text = String(row.totalSinglePunch);
    else {
      const dayNum = Number(col.key.replace("day", ""));
      const d = row.days.find((x) => x.day === dayNum);
      text = d?.status || "";
      fill = d?.status ? STATUS_COLORS[d.status] : "#ffffff";
    }
    doc.rect(cx, y, col.width, ROW_HEIGHT).fillAndStroke(fill, BORDER_COLOR);
    doc.fillColor(fill === "#ffffff" ? "#111827" : "#ffffff").text(text, cx + 1, y + ROW_HEIGHT / 2 - 3.5, {
      width: col.width - 2,
      align: "center",
    });
    cx += col.width;
  });
}

function buildTeamAttendancePdf({ daysInMonth, rows, monthLabel }) {
  const columns = buildColumns(daysInMonth);
  const totalWidth = columns.reduce((sum, c) => sum + c.width, 0) + MARGIN * 2;
  const pageSize = [totalWidth, PAGE_HEIGHT];
  const doc = new PDFDocument({ size: pageSize, margin: MARGIN });
  const bottomLimit = PAGE_HEIGHT - MARGIN;

  const drawTitle = () => {
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827").text(`Team Attendance — ${monthLabel}`, MARGIN, MARGIN - 8);
  };

  drawTitle();
  let y = MARGIN + TITLE_HEIGHT;
  drawHeaderRow(doc, columns, MARGIN, y);
  y += HEADER_HEIGHT;

  rows.forEach((row) => {
    if (y + ROW_HEIGHT > bottomLimit) {
      doc.addPage({ size: pageSize, margin: MARGIN });
      y = MARGIN;
      drawHeaderRow(doc, columns, MARGIN, y);
      y += HEADER_HEIGHT;
    }
    drawDataRow(doc, columns, row, MARGIN, y);
    y += ROW_HEIGHT;
  });

  return doc;
}

module.exports = { buildTeamAttendancePdf };
