const express = require("express");

const {
  getDashboardSummary,
  getSystemHealth,
  getAllUsers,
  getUserById,
  updateUserStatus,
  approveDoctor,
  deleteUser,
  getAllAppointments,
  getAppointmentStats,
  getAuditLogs,
  getNotificationStats,
} = require("../controllers/adminController");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");

const router = express.Router();

router.use(authenticate);
router.use(authorize("ADMIN"));

router.get("/dashboard", getDashboardSummary);
router.get("/system-health", getSystemHealth);
router.get("/users", getAllUsers);
router.get("/users/:id", getUserById);
router.patch("/users/:id/status", updateUserStatus);
router.patch("/users/:id/approve", approveDoctor);
router.delete("/users/:id", deleteUser);
router.get("/appointments/stats", getAppointmentStats);
router.get("/appointments", getAllAppointments);
router.get("/audit-logs", getAuditLogs);
router.get("/notifications/stats", getNotificationStats);

module.exports = router;
