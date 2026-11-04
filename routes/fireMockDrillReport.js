const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/fireMockDrillReportController");
const asyncHandler = require("../utils/asyncHandler");

router.get("/meta", asyncHandler(ctrl.meta));
router.get("/submission-for", asyncHandler(ctrl.submissionFor));
router.get("/by-date", asyncHandler(ctrl.getByDate));
router.post("/draft", asyncHandler(ctrl.saveDraft));
router.get("/kpi", asyncHandler(ctrl.kpi));
router.get("/kpi/export-pdf", asyncHandler(ctrl.kpiExportPdf));
router.get("/submitted", asyncHandler(ctrl.listSubmitted));
router.get("/:id", asyncHandler(ctrl.getReport));
router.post("/:id/submit", asyncHandler(ctrl.submitReport));
router.post("/:id/unlock", asyncHandler(ctrl.unlockReport));
router.get("/:id/export", asyncHandler(ctrl.exportExcel));
router.get("/:id/export-pdf", asyncHandler(ctrl.exportPdf));

module.exports = router;
