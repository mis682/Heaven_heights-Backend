const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/patrolController");
const asyncHandler = require("../utils/asyncHandler");

router.post("/submissions", asyncHandler(ctrl.createSubmission));
router.get("/summary", asyncHandler(ctrl.getSummary));
router.get("/submissions", asyncHandler(ctrl.listSubmissions));
router.get("/submissions/:id", asyncHandler(ctrl.getSubmission));

module.exports = router;
