const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/roleController");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth, requirePermission } = require("../middleware/auth");

router.use(requireAuth);

router.get("/", requirePermission("users", "view"), asyncHandler(ctrl.list));
router.post("/", requirePermission("users", "edit"), asyncHandler(ctrl.create));
router.put("/:id", requirePermission("users", "edit"), asyncHandler(ctrl.update));
router.delete("/:id", requirePermission("users", "delete"), asyncHandler(ctrl.remove));

module.exports = router;
