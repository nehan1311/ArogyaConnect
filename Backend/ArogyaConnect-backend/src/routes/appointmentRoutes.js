const express = require("express");

const {
  bookAppointment,
  getMyAppointments,
  getAppointmentById,
  cancelAppointment,
  updateConsultationNotes,
} = require("../controllers/appointmentController");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");

const router = express.Router();

router.post("/", authenticate, authorize("PATIENT"), bookAppointment);
router.get(
  "/my",
  authenticate,
  authorize("PATIENT", "DOCTOR"),
  getMyAppointments
);
router.get("/:id", authenticate, getAppointmentById);
router.patch("/:id/cancel", authenticate, cancelAppointment);
router.patch(
  "/:id/notes",
  authenticate,
  authorize("DOCTOR"),
  updateConsultationNotes
);

module.exports = router;
