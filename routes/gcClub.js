const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/gcClubController");
const asyncHandler = require("../utils/asyncHandler");

router.post("/submissions", asyncHandler(ctrl.createSubmission));
router.get("/submissions", asyncHandler(ctrl.listSubmissions));
router.get("/submissions/:id", asyncHandler(ctrl.getSubmission));

module.exports = router;
