const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/gcHousekeepingController");
const { uploadHousekeeping } = require("../middleware/upload");
const asyncHandler = require("../utils/asyncHandler");

router.post("/submissions/start", asyncHandler(ctrl.startSubmission));
router.post("/submissions/:id/photo", uploadHousekeeping.single("photo"), asyncHandler(ctrl.addPhoto));
router.post("/submissions/:id/finalize", asyncHandler(ctrl.finalizeSubmission));
router.get("/submissions", asyncHandler(ctrl.listSubmissions));
router.get("/submissions/:id", asyncHandler(ctrl.getSubmission));

module.exports = router;
