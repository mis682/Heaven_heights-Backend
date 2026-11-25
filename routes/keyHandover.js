const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/keyHandoverController");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth, requirePermission } = require("../middleware/auth");

// Meta and create stay public — this is the Key Handover Form the driver
// fills in themselves, no login.
router.get("/meta", asyncHandler(ctrl.meta));
router.post("/", asyncHandler(ctrl.create));

router.get("/", requireAuth, requirePermission("keyHandover", "view"), asyncHandler(ctrl.list));
router.patch("/:id/out-time", requireAuth, requirePermission("keyHandover", "edit"), asyncHandler(ctrl.setOutTime));
router.put("/:id", requireAuth, requirePermission("keyHandover", "edit"), asyncHandler(ctrl.update));
router.delete("/:id", requireAuth, requirePermission("keyHandover", "delete"), asyncHandler(ctrl.remove));

module.exports = router;
