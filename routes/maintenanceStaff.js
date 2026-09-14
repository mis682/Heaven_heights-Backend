const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/maintenanceStaffController");
const asyncHandler = require("../utils/asyncHandler");
const { upload } = require("../middleware/upload");

router.get("/meta", asyncHandler(ctrl.meta));
router.get("/stats", asyncHandler(ctrl.stats));
router.get("/next-id", asyncHandler(ctrl.nextId));
router.get("/", asyncHandler(ctrl.list));
router.post("/", upload.single("photo"), asyncHandler(ctrl.create));
router.put("/:id", upload.single("photo"), asyncHandler(ctrl.update));
router.get("/:id/id-card", asyncHandler(ctrl.idCard));
router.delete("/:id", asyncHandler(ctrl.remove));

module.exports = router;
