const express = require("express");
const router = express.Router();

const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const { createRoom, joinRoom, endSession, getSession } = require("../controllers/videoController");

router.post("/room", authenticate, authorize("DOCTOR"), createRoom);
router.post("/join", authenticate, authorize("DOCTOR", "PATIENT"), joinRoom);
router.post("/end", authenticate, authorize("DOCTOR", "PATIENT"), endSession);
router.get("/session/:appointmentId", authenticate, getSession);

module.exports = router;
