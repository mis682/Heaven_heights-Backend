const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/fireMockDrillController");
const asyncHandler = require("../utils/asyncHandler");
const { uploadMixed } = require("../middleware/upload");

const fields = uploadMixed.fields([
  { name: "panelPhoto", maxCount: 1 },
  { name: "reportAttachment", maxCount: 1 },
  { name: "checklistAttachments", maxCount: 5 },
]);

router.get("/meta", asyncHandler(ctrl.meta));
router.get("/upload-signature", asyncHandler(ctrl.getUploadSignature));
router.get("/", asyncHandler(ctrl.list));
router.get("/:id", asyncHandler(ctrl.getOne));
router.post("/", fields, asyncHandler(ctrl.create));
router.put("/:id", fields, asyncHandler(ctrl.update));
router.delete("/:id", asyncHandler(ctrl.remove));

module.exports = router;
