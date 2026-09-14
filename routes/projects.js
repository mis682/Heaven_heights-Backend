const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/projectController");
const asyncHandler = require("../utils/asyncHandler");

router.get("/", asyncHandler(ctrl.list));
router.get("/:slug", asyncHandler(ctrl.getBySlug));
router.patch("/:slug/checkpoint-count", asyncHandler(ctrl.updateCheckpointCount));

module.exports = router;
