const express = require("express");
const multer = require("multer");
const router = express.Router();
const ctrl = require("../controllers/guardController");
const asyncHandler = require("../utils/asyncHandler");

const csvUpload = multer({ storage: multer.memoryStorage() });

router.get("/", asyncHandler(ctrl.list));
router.post("/", asyncHandler(ctrl.create));
router.put("/:id", asyncHandler(ctrl.update));
router.delete("/:id", asyncHandler(ctrl.remove));
router.post("/bulk-import", csvUpload.single("file"), asyncHandler(ctrl.bulkImport));

module.exports = router;
