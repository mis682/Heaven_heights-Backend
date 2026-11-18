const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/maintenanceStaffInOutController");
const asyncHandler = require("../utils/asyncHandler");

router.get("/", asyncHandler(ctrl.list));
router.post("/", asyncHandler(ctrl.create));
router.patch("/:id/out-time", asyncHandler(ctrl.setOutTime));

module.exports = router;
