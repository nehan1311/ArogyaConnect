const express = require("express");

const {
  getMyNotifications,
  getNotificationStats,
} = require("../controllers/notificationController");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");

const router = express.Router();

router.get("/my", authenticate, getMyNotifications);
router.get("/stats", authenticate, authorize("ADMIN"), getNotificationStats);

module.exports = router;
