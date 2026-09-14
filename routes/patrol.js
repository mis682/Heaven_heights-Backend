const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/patrolController");
const { upload } = require("../middleware/upload");
const asyncHandler = require("../utils/asyncHandler");

router.post("/submissions", upload.array("photos", 20), asyncHandler(ctrl.createSubmission));
router.get("/summary", asyncHandler(ctrl.getSummary));
router.get("/submissions", asyncHandler(ctrl.listSubmissions));
router.get("/submissions/:id", asyncHandler(ctrl.getSubmission));

module.exports = router;
