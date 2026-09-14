const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/patrolReportController");
const asyncHandler = require("../utils/asyncHandler");

router.get("/meta", asyncHandler(ctrl.meta));
router.get("/proof", asyncHandler(ctrl.getCheckpointProof));
router.get("/guard-kpi", asyncHandler(ctrl.getGuardKpi));

router.get("/submitted", asyncHandler(ctrl.listSubmittedReports));
router.get("/open-draft", asyncHandler(ctrl.getOpenDraft));
router.post("/draft", asyncHandler(ctrl.saveDraft));
router.post("/:id/submit", asyncHandler(ctrl.submitReport));
router.post("/:id/unlock", asyncHandler(ctrl.unlockReport));
router.get("/:id/export", asyncHandler(ctrl.exportReport));
router.get("/:id/export-pdf", asyncHandler(ctrl.exportReportPdf));
router.get("/:id", asyncHandler(ctrl.getReport));

module.exports = router;
