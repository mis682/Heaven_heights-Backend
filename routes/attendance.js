const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/attendanceController");
const asyncHandler = require("../utils/asyncHandler");

router.get("/stats", asyncHandler(ctrl.stats));
router.get("/", asyncHandler(ctrl.list));
router.post("/", asyncHandler(ctrl.create));
router.put("/:id", asyncHandler(ctrl.update));
router.delete("/:id", asyncHandler(ctrl.remove));

module.exports = router;
