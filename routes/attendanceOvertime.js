const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/attendanceOvertimeController");
const asyncHandler = require("../utils/asyncHandler");

router.get("/", asyncHandler(ctrl.list));
router.put("/", asyncHandler(ctrl.setOvertime));

module.exports = router;
