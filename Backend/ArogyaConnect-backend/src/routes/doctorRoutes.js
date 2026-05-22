const express = require("express");

const {
  searchDoctors,
  getDoctorAvailability,
  setDoctorAvailability,
} = require("../controllers/appointmentController");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");

const router = express.Router();

router.get("/", searchDoctors);
router.get("/:doctorId/availability", getDoctorAvailability);
router.post(
  "/availability",
  authenticate,
  authorize("DOCTOR"),
  setDoctorAvailability
);

module.exports = router;
