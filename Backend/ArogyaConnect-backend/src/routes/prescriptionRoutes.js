const express = require("express");

const {
  issuePrescription,
  getMyPrescriptions,
  getPatientPrescriptions,
  getPrescriptionById,
  updateStatus,
  requestRefill,
} = require("../controllers/prescriptionController");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");

const router = express.Router();

router.post("/", authenticate, authorize("DOCTOR"), issuePrescription);
router.get("/my", authenticate, authorize("PATIENT"), getMyPrescriptions);
router.get(
  "/patient/:patientId",
  authenticate,
  authorize("DOCTOR", "ADMIN"),
  getPatientPrescriptions
);
router.get("/:id", authenticate, getPrescriptionById);
router.patch("/:id/status", authenticate, authorize("DOCTOR"), updateStatus);
router.post("/:id/refill", authenticate, authorize("PATIENT"), requestRefill);

module.exports = router;
