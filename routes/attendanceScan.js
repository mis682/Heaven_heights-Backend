const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/attendanceScanController");
const asyncHandler = require("../utils/asyncHandler");
const { upload } = require("../middleware/upload");
const { requireAuth, requirePermission } = require("../middleware/auth");

// Lookup and scan submission stay public (no requireAuth) — this is the
// kiosk/phone QR flow staff use themselves to punch in/out, not something
// gated behind a dashboard login. Everything else here is the Team
// Attendance dashboard, so it requires both a login and the Attendance
// module's own permission.
router.get("/lookup/:employeeId", asyncHandler(ctrl.lookup));
router.post("/", upload.single("photo"), asyncHandler(ctrl.scan));

router.get("/records", requireAuth, requirePermission("attendance", "view"), asyncHandler(ctrl.records));
router.get("/team-summary", requireAuth, requirePermission("attendance", "view"), asyncHandler(ctrl.monthSummary));
router.get(
  "/team-summary/export",
  requireAuth,
  requirePermission("attendance", "view"),
  asyncHandler(ctrl.exportTeamAttendanceExcel)
);
router.get(
  "/team-summary/export-pdf",
  requireAuth,
  requirePermission("attendance", "view"),
  asyncHandler(ctrl.exportTeamAttendancePdf)
);
router.post("/override", requireAuth, requirePermission("attendance", "edit"), asyncHandler(ctrl.setAttendanceOverride));
router.delete("/override", requireAuth, requirePermission("attendance", "edit"), asyncHandler(ctrl.clearAttendanceOverride));
router.delete("/:id", requireAuth, requirePermission("attendance", "delete"), asyncHandler(ctrl.remove));

module.exports = router;
