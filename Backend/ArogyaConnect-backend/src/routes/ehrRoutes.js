const express = require("express");

const {
  getMyEHR,
  getPatientEHR,
  addEntry,
  generateShareToken,
  revokeShareToken,
  getAuditLogs,
} = require("../controllers/ehrController");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");

const router = express.Router();

router.get("/me", authenticate, authorize("PATIENT"), getMyEHR);
router.post("/share", authenticate, authorize("PATIENT"), generateShareToken);
router.patch(
  "/share/:tokenId/revoke",
  authenticate,
  authorize("PATIENT"),
  revokeShareToken
);
router.get("/:patientId/audit", authenticate, getAuditLogs);
router.post(
  "/:patientId/entries",
  authenticate,
  authorize("DOCTOR", "ADMIN"),
  addEntry
);
router.get("/:patientId", authenticate, getPatientEHR);

module.exports = router;
