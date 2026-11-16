const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/maintenanceStaffInOutController");
const asyncHandler = require("../utils/asyncHandler");

router.get("/meta", asyncHandler(ctrl.meta));
router.get("/", asyncHandler(ctrl.list));
router.post("/", asyncHandler(ctrl.create));

module.exports = router;
