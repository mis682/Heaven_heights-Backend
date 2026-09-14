const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/reserveClubReportController");
const asyncHandler = require("../utils/asyncHandler");

router.get("/meta", asyncHandler(ctrl.meta));
router.get("/by-date", asyncHandler(ctrl.getByDate));
router.get("/submitted", asyncHandler(ctrl.listSubmitted));
router.post("/draft", asyncHandler(ctrl.saveDraft));
router.post("/:id/submit", asyncHandler(ctrl.submitReport));
router.post("/:id/unlock", asyncHandler(ctrl.unlockReport));
router.get("/:id/export", asyncHandler(ctrl.exportExcel));
router.get("/:id/export-pdf", asyncHandler(ctrl.exportPdf));
router.get("/:id", asyncHandler(ctrl.getReport));

module.exports = router;
