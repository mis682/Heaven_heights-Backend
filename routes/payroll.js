const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/payrollController");
const asyncHandler = require("../utils/asyncHandler");

router.get("/meta", asyncHandler(ctrl.meta));
router.get("/:designation/excel", asyncHandler(ctrl.exportExcel));
router.get("/:designation/pdf", asyncHandler(ctrl.exportPdf));
router.get("/:designation", asyncHandler(ctrl.getDesignationPayroll));

module.exports = router;
