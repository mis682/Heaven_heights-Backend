const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/staffProfileController");
const asyncHandler = require("../utils/asyncHandler");

router.get("/:employeeId", asyncHandler(ctrl.getProfile));
router.put("/:employeeId", asyncHandler(ctrl.updateProfile));

module.exports = router;
