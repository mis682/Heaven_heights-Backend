const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/reserveClubController");
const { uploadHousekeeping } = require("../middleware/upload");
const asyncHandler = require("../utils/asyncHandler");

router.post("/submissions", uploadHousekeeping.array("photos", 40), asyncHandler(ctrl.createSubmission));
router.get("/submissions", asyncHandler(ctrl.listSubmissions));
router.get("/submissions/:id", asyncHandler(ctrl.getSubmission));

module.exports = router;
