const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/attendanceScanController");
const asyncHandler = require("../utils/asyncHandler");
const { upload } = require("../middleware/upload");

router.get("/records", asyncHandler(ctrl.records));
router.get("/team-summary", asyncHandler(ctrl.monthSummary));
router.post("/override", asyncHandler(ctrl.setAttendanceOverride));
router.delete("/override", asyncHandler(ctrl.clearAttendanceOverride));
router.get("/team-summary/export", asyncHandler(ctrl.exportTeamAttendanceExcel));
router.get("/team-summary/export-pdf", asyncHandler(ctrl.exportTeamAttendancePdf));
router.get("/lookup/:employeeId", asyncHandler(ctrl.lookup));
router.post("/", upload.single("photo"), asyncHandler(ctrl.scan));
router.delete("/:id", asyncHandler(ctrl.remove));

module.exports = router;
