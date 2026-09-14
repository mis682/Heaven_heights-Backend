const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/idCardPrintController");
const asyncHandler = require("../utils/asyncHandler");

router.get("/", asyncHandler(ctrl.printIdCards));

module.exports = router;
