const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/maintenanceAuditController");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { upload } = require("../middleware/upload");

// Meta and create stay public — this is the Maintenance Audit Form filled
// in by whoever's doing the audit, no login.
router.get("/meta", asyncHandler(ctrl.meta));
router.post(
  "/",
  upload.fields([
    { name: "image1", maxCount: 1 },
    { name: "image2", maxCount: 1 },
  ]),
  asyncHandler(ctrl.createSubmission)
);

router.get("/submissions", requireAuth, requirePermission("maintenanceAudit", "view"), asyncHandler(ctrl.listSubmissions));

module.exports = router;
