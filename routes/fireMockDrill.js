const express = require("express");
const multer = require("multer");
const router = express.Router();
const ctrl = require("../controllers/fireMockDrillController");
const asyncHandler = require("../utils/asyncHandler");

// Memory storage — the controller needs the raw buffer to hand to ffmpeg
// (for videos) or straight to Drive (everything else). 150MB covers a
// pre-compression 20-second 4K video with headroom; compression then
// shrinks whatever actually gets stored.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 150 * 1024 * 1024 } });

router.get("/meta", asyncHandler(ctrl.meta));
router.post("/upload", upload.single("file"), asyncHandler(ctrl.uploadFile));
router.get("/", asyncHandler(ctrl.list));
router.get("/:id", asyncHandler(ctrl.getOne));
router.post("/", asyncHandler(ctrl.create));
router.put("/:id", asyncHandler(ctrl.update));
router.delete("/:id", asyncHandler(ctrl.remove));

module.exports = router;
