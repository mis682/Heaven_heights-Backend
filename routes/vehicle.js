const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/vehicleController");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth, requirePermission } = require("../middleware/auth");

// Meta and submission stay public — this is the Daily Basis Ride Form
// drivers/guards fill in themselves, no login.
router.get("/meta", asyncHandler(ctrl.meta));
router.post("/", asyncHandler(ctrl.createSubmission));

router.get("/submissions", requireAuth, requirePermission("vehicleManagement", "view"), asyncHandler(ctrl.listSubmissions));
router.get("/daily-report", requireAuth, requirePermission("vehicleManagement", "view"), asyncHandler(ctrl.dailyReport));
router.put("/:id", requireAuth, requirePermission("vehicleManagement", "edit"), asyncHandler(ctrl.updateSubmission));
router.delete("/:id", requireAuth, requirePermission("vehicleManagement", "delete"), asyncHandler(ctrl.deleteSubmission));

module.exports = router;
