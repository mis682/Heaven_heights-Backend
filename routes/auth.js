const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/authController");
const asyncHandler = require("../utils/asyncHandler");

router.post("/login", asyncHandler(ctrl.login));
router.post("/verify", asyncHandler(ctrl.verify));

module.exports = router;
