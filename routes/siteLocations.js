const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/siteLocationController");
const asyncHandler = require("../utils/asyncHandler");

router.get("/", asyncHandler(ctrl.list));
router.put("/:siteName", asyncHandler(ctrl.upsert));
router.patch("/:siteName/enabled", asyncHandler(ctrl.setEnabled));
router.delete("/:siteName", asyncHandler(ctrl.remove));

module.exports = router;
