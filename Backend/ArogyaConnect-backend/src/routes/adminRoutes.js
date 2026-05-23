const express = require("express");

const authenticate = require("../middlewares/authenticate");
const authorize    = require("../middlewares/authorize");
const {
  getStats,
  getDoctors,
  getPatients,
  approveDoctor,
  rejectDoctor,
  suspendDoctor,
  reactivateDoctor,
  deactivatePatient,
  activatePatient,
} = require("../controllers/adminController");

const router = express.Router();

// All admin routes require a valid JWT AND the ADMIN role
router.use(authenticate, authorize("ADMIN"));

// ── Stats ────────────────────────────────────────────────────────
router.get("/stats", getStats);

// ── Doctor management ────────────────────────────────────────────
router.get("/doctors",                    getDoctors);
router.patch("/doctors/:id/approve",      approveDoctor);
router.patch("/doctors/:id/reject",       rejectDoctor);
router.patch("/doctors/:id/suspend",      suspendDoctor);
router.patch("/doctors/:id/reactivate",   reactivateDoctor);

// ── Patient management ───────────────────────────────────────────
router.get("/patients",                   getPatients);
router.patch("/patients/:id/deactivate",  deactivatePatient);
router.patch("/patients/:id/activate",    activatePatient);

module.exports = router;
