// Separate from maintenanceStaffController.js on purpose — this only reads
// MaintenanceStaff records, it never touches the existing staff management
// routes/controller so that flow stays completely unmodified.
const MaintenanceStaff = require("../models/MaintenanceStaff");
const { buildMultiIdCardPdf } = require("../utils/idCardPdf");

exports.printIdCards = async (req, res) => {
  const ids = (req.query.ids || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) return res.status(400).json({ message: "ids query param is required" });

  const staffList = await MaintenanceStaff.find({ _id: { $in: ids } });
  if (staffList.length === 0) return res.status(404).json({ message: "No staff found for given ids" });

  // Preserve the order the caller requested rather than Mongo's natural order.
  const byId = new Map(staffList.map((s) => [s._id.toString(), s]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean);

  const doc = await buildMultiIdCardPdf(ordered);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename=id-cards-${Date.now()}.pdf`);
  doc.pipe(res);
  doc.end();
};
