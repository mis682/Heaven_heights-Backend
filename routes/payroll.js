const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/payrollController");
const asyncHandler = require("../utils/asyncHandler");

router.get("/meta", asyncHandler(ctrl.meta));
router.get("/:company/excel", asyncHandler(ctrl.exportExcel));
router.get("/:company/pdf", asyncHandler(ctrl.exportPdf));
router.get("/:company", asyncHandler(ctrl.getCompanyPayroll));

module.exports = router;
