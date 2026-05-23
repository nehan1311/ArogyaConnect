const mongoose = require("mongoose");

const User = require("../models/User");
const Appointment = require("../models/Appointment");
const Prescription = require("../models/Prescription");
const Notification = require("../models/Notification");
const { AuditLog, createAuditLog } = require("../models/AuditLog");
let VideoSession = null;
try {
  VideoSession = require("../models/VideoSession");
} catch (_) {}
let TriageReport = null;
try {
  TriageReport = require("../models/TriageReport");
} catch (_) {}
const emailService = require("../services/emailService");

const createError = (message, statusCode) => {
  const e = new Error(message);
  e.statusCode = statusCode;
  return e;
};

const SAFE_USER_SELECT = [
  "_id",
  "name",
  "email",
  "role",
  "isActive",
  "isApproved",
  "createdAt",
  "profile.specialization",
  "profile.phone",
  "profile.licenseNumber",
].join(" ");

const APPOINTMENT_STATUSES = [
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
  "IN_PROGRESS",
  "REQUESTED",
];

const parseBoolean = (value) => {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
};

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toPositiveInteger = (value, fallback) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
};

const countDocumentsSafe = (Model, query = {}) =>
  Model ? Model.countDocuments(query) : Promise.resolve(0);

const buildAggregateCountObject = (rows) =>
  rows.reduce((accumulator, row) => {
    if (row && row._id) {
      accumulator[row._id] = row.count;
    }

    return accumulator;
  }, {});

const normalizeBooleanInput = (value) => {
  if (typeof value === "boolean") {
    return value;
  }

  return parseBoolean(value);
};

const getAllUsers = async (req, res) => {
  const page = toPositiveInteger(req.query.page, 1);
  const limit = toPositiveInteger(req.query.limit, 20);
  const skip = (page - 1) * limit;
  const query = {};

  if (req.query.role) {
    query.role = req.query.role;
  }

  const isActive = parseBoolean(req.query.isActive);
  if (typeof isActive === "boolean") {
    query.isActive = isActive;
  }

  const isApproved = parseBoolean(req.query.isApproved);
  if (typeof isApproved === "boolean") {
    query.isApproved = isApproved;
  }

  if (req.query.search) {
    const regex = new RegExp(escapeRegex(req.query.search), "i");
    query.$or = [{ name: regex }, { email: regex }];
  }

  const [users, total] = await Promise.all([
    User.find(query)
      .select(SAFE_USER_SELECT)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    total,
    page,
    count: users.length,
    users,
  });
};

const getUserById = async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id).select(SAFE_USER_SELECT);

  if (!user) {
    throw createError("User not found", 404);
  }

  const [
    appointmentCount,
    prescriptionCount,
    videoSessionCount,
    triageCount,
  ] = await Promise.all([
    Appointment.countDocuments({
      $or: [{ patient: id }, { doctor: id }],
    }),
    Prescription.countDocuments({
      $or: [{ patient: id }, { doctor: id }],
    }),
    countDocumentsSafe(VideoSession, {
      $or: [{ patient: id }, { doctor: id }],
    }),
    TriageReport
      ? TriageReport.countDocuments({ patient: id })
      : Promise.resolve(0),
  ]);

  res.status(200).json({
    success: true,
    user,
    stats: {
      appointmentCount,
      prescriptionCount,
      videoSessionCount,
      triageCount,
    },
  });
};

const updateUserStatus = async (req, res) => {
  const { id } = req.params;
  const { isActive, isApproved, reason } = req.body;
  const user = await User.findById(id);

  if (!user) {
    throw createError("User not found", 404);
  }

  if (user.role === "ADMIN") {
    throw createError("Cannot modify another admin account", 403);
  }

  if (req.user.id === id) {
    throw createError("Cannot modify your own account via this route", 403);
  }

  const updates = {};

  if (Object.prototype.hasOwnProperty.call(req.body, "isActive")) {
    const normalizedIsActive = normalizeBooleanInput(isActive);
    if (typeof normalizedIsActive === "boolean") {
      updates.isActive = normalizedIsActive;
    }
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "isApproved")) {
    const normalizedIsApproved = normalizeBooleanInput(isApproved);
    if (typeof normalizedIsApproved === "boolean") {
      updates.isApproved = normalizedIsApproved;
    }
  }

  Object.assign(user, updates);

  if (updates.isActive === false) {
    user.refreshToken = undefined;
  }

  await user.save({ validateBeforeSave: false });

  await createAuditLog({
    action: "ADMIN_USER_UPDATE",
    targetResource: "User",
    targetId: id,
    actor: req.user.id,
    actorRole: "ADMIN",
    patient: user.role === "PATIENT" ? id : undefined,
    metadata: { changes: req.body, reason },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  const updatedUser = await User.findById(id).select(SAFE_USER_SELECT);

  res.status(200).json({
    success: true,
    message: "User status updated.",
    user: updatedUser,
  });
};

const approveDoctor = async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id);

  if (!user) {
    throw createError("User not found", 404);
  }

  if (user.role !== "DOCTOR") {
    throw createError("User is not a doctor", 400);
  }

  if (user.isApproved) {
    throw createError("Doctor is already approved", 400);
  }

  user.isApproved = true;
  await user.save({ validateBeforeSave: false });

  (async () => {
    try {
      await emailService.sendEmail({
        to: user.email,
        subject: "Your Telehealth Doctor Account Has Been Approved",
        html: `
        <h2>Account Approved</h2>
        <p>Dear Dr. ${user.name},</p>
        <p>Your doctor account on our Telehealth platform has been approved.</p>
        <p>You can now log in and start accepting patient appointments.</p>
        <p>Welcome to the platform!</p>
      `,
      });
    } catch (_) {}
  })();

  await createAuditLog({
    action: "ADMIN_USER_UPDATE",
    targetResource: "User",
    targetId: id,
    actor: req.user.id,
    actorRole: "ADMIN",
    metadata: { action: "DOCTOR_APPROVED", doctorEmail: user.email },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  res.status(200).json({
    success: true,
    message: "Doctor account approved successfully.",
  });
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id);

  if (!user) {
    throw createError("User not found", 404);
  }

  if (user.role === "ADMIN") {
    throw createError("Cannot delete an admin account", 403);
  }

  if (req.user.id === id) {
    throw createError("Cannot delete your own account", 403);
  }

  user.isActive = false;
  user.email = `deleted_${user._id.toString()}@deleted.telehealth`;
  user.name = "Deleted User";
  user.refreshToken = undefined;

  await user.save({ validateBeforeSave: false });

  await createAuditLog({
    action: "ADMIN_USER_UPDATE",
    targetResource: "User",
    targetId: id,
    actor: req.user.id,
    actorRole: "ADMIN",
    patient: user.role === "PATIENT" ? id : undefined,
    metadata: { action: "USER_SOFT_DELETED" },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  res.status(200).json({
    success: true,
    message: "User account has been deactivated and anonymized.",
  });
};

const getAllAppointments = async (req, res) => {
  const page = toPositiveInteger(req.query.page, 1);
  const limit = toPositiveInteger(req.query.limit, 20);
  const skip = (page - 1) * limit;
  const query = {};

  if (req.query.status) {
    query.status = req.query.status;
  }

  if (req.query.doctorId) {
    query.doctor = req.query.doctorId;
  }

  if (req.query.patientId) {
    query.patient = req.query.patientId;
  }

  if (req.query.date) {
    const start = new Date(`${req.query.date}T00:00:00.000Z`);
    const end = new Date(`${req.query.date}T23:59:59.999Z`);
    query.date = { $gte: start, $lte: end };
  }

  const [appointments, total] = await Promise.all([
    Appointment.find(query)
      .populate("patient", "name email")
      .populate("doctor", "name email profile.specialization")
      .sort({ date: -1, startTime: -1 })
      .skip(skip)
      .limit(limit),
    Appointment.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    total,
    page,
    count: appointments.length,
    appointments,
  });
};

const getAppointmentStats = async (req, res) => {
  const now = new Date();
  const startOfToday = new Date(
    `${now.toISOString().split("T")[0]}T00:00:00.000Z`
  );
  const endOfToday = new Date(
    `${now.toISOString().split("T")[0]}T23:59:59.999Z`
  );
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    total,
    byStatusRows,
    todayCount,
    thisWeekCount,
    thisMonthCount,
    cancelledCount,
    distinctDoctors,
  ] = await Promise.all([
    Appointment.countDocuments(),
    Appointment.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),
    Appointment.countDocuments({
      date: { $gte: startOfToday, $lte: endOfToday },
    }),
    Appointment.countDocuments({ date: { $gte: startOfWeek } }),
    Appointment.countDocuments({ date: { $gte: startOfMonth } }),
    Appointment.countDocuments({ status: "CANCELLED" }),
    Appointment.distinct("doctor"),
  ]);

  const byStatus = APPOINTMENT_STATUSES.reduce((accumulator, status) => {
    accumulator[status] = 0;
    return accumulator;
  }, {});

  for (const row of byStatusRows) {
    if (row && row._id) {
      byStatus[row._id] = row.count;
    }
  }

  const cancellationRate =
    total > 0
      ? Math.round(((cancelledCount / total) * 100 * 100)) / 100
      : 0;
  const avgPerDoctor =
    distinctDoctors.length > 0
      ? Math.round((total / distinctDoctors.length) * 100) / 100
      : 0;

  res.status(200).json({
    success: true,
    stats: {
      total,
      byStatus,
      todayCount,
      thisWeekCount,
      thisMonthCount,
      cancellationRate,
      avgPerDoctor,
    },
  });
};

const getAuditLogs = async (req, res) => {
  const page = toPositiveInteger(req.query.page, 1);
  const limit = Math.min(toPositiveInteger(req.query.limit, 50), 100);
  const skip = (page - 1) * limit;
  const query = {};

  if (req.query.action) {
    query.action = req.query.action;
  }

  if (req.query.actorId) {
    query.actor = req.query.actorId;
  }

  if (req.query.patientId) {
    query.patient = req.query.patientId;
  }

  if (req.query.targetResource) {
    query.targetResource = req.query.targetResource;
  }

  if (req.query.from || req.query.to) {
    query.createdAt = {};

    if (req.query.from) {
      query.createdAt.$gte = new Date(`${req.query.from}T00:00:00.000Z`);
    }

    if (req.query.to) {
      query.createdAt.$lte = new Date(`${req.query.to}T23:59:59.999Z`);
    }
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .populate("actor", "name email role")
      .populate("patient", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    AuditLog.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    total,
    page,
    count: logs.length,
    logs,
  });
};

const getNotificationStats = async (req, res) => {
  const [total, byTypeRows, byStatusRows, failedRecent] = await Promise.all([
    Notification.countDocuments(),
    Notification.aggregate([
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
        },
      },
    ]),
    Notification.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),
    Notification.find({ status: "FAILED" })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("recipient", "name email"),
  ]);

  res.status(200).json({
    success: true,
    stats: {
      total,
      byType: buildAggregateCountObject(byTypeRows),
      byStatus: buildAggregateCountObject(byStatusRows),
      failedRecent,
    },
  });
};

const getSystemHealth = async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbName = mongoose.connection.name;
  const dbHost = mongoose.connection.host;
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const memoryUsage = process.memoryUsage();
  const system = {
    uptime: Math.round(process.uptime()),
    memoryMB: {
      rss: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100,
      heapUsed: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
      heapTotal: Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100,
    },
    nodeVersion: process.version,
    platform: process.platform,
  };

  const [
    userCount,
    appointmentCount,
    prescriptionCount,
    notificationCount,
    auditLogCount,
    videoSessionCount,
    triageCount,
    pendingNotifications,
    failedNotifications,
    recentAppointments,
    recentRegistrations,
    recentAuditEvents,
  ] = await Promise.all([
    countDocumentsSafe(User),
    countDocumentsSafe(Appointment),
    countDocumentsSafe(Prescription),
    countDocumentsSafe(Notification),
    countDocumentsSafe(AuditLog),
    countDocumentsSafe(VideoSession),
    TriageReport ? TriageReport.countDocuments() : Promise.resolve(0),
    Notification.countDocuments({ status: "PENDING" }),
    Notification.countDocuments({ status: "FAILED" }),
    Appointment.countDocuments({ createdAt: { $gte: last24h } }),
    User.countDocuments({ createdAt: { $gte: last24h } }),
    AuditLog.countDocuments({ createdAt: { $gte: last24h } }),
  ]);

  res.status(200).json({
    success: true,
    timestamp: new Date().toISOString(),
    system,
    database: {
      state: dbState === 1 ? "connected" : "disconnected",
      dbName,
      dbHost,
      dbState,
    },
    collections: {
      users: userCount,
      appointments: appointmentCount,
      prescriptions: prescriptionCount,
      notifications: notificationCount,
      auditLogs: auditLogCount,
      videoSessions: videoSessionCount,
      triageReports: triageCount,
    },
    notifications: {
      pending: pendingNotifications,
      failed: failedNotifications,
    },
    recentActivity: {
      appointments: recentAppointments,
      registrations: recentRegistrations,
      auditEvents: recentAuditEvents,
    },
  });
};

const getDashboardSummary = async (req, res) => {
  const now = new Date();
  const startOfToday = new Date(
    `${now.toISOString().split("T")[0]}T00:00:00.000Z`
  );
  const endOfToday = new Date(
    `${now.toISOString().split("T")[0]}T23:59:59.999Z`
  );

  const [
    totalUsers,
    totalDoctors,
    totalPatients,
    pendingApprovals,
    todayAppointments,
    activeVideoSessions,
    failedNotifications,
    criticalTriageToday,
    recentUsers,
    recentAppointments,
  ] = await Promise.all([
    User.countDocuments({ isActive: true }),
    User.countDocuments({ role: "DOCTOR", isActive: true }),
    User.countDocuments({ role: "PATIENT", isActive: true }),
    User.countDocuments({
      role: "DOCTOR",
      isApproved: false,
      isActive: true,
    }),
    Appointment.countDocuments({
      date: { $gte: startOfToday, $lte: endOfToday },
    }),
    countDocumentsSafe(VideoSession, { status: "ACTIVE" }),
    Notification.countDocuments({ status: "FAILED" }),
    TriageReport
      ? TriageReport.countDocuments({
          isCritical: true,
          createdAt: { $gte: startOfToday },
        })
      : Promise.resolve(0),
    User.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name email role isApproved createdAt"),
    Appointment.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("patient", "name email")
      .populate("doctor", "name email")
      .select("date startTime status patient doctor"),
  ]);

  res.status(200).json({
    success: true,
    summary: {
      users: {
        total: totalUsers,
        doctors: totalDoctors,
        patients: totalPatients,
        pendingApprovals,
      },
      appointments: {
        today: todayAppointments,
        activeVideoSessions,
      },
      triage: {
        criticalToday: criticalTriageToday,
      },
      notifications: {
        failed: failedNotifications,
      },
      recentUsers,
      recentAppointments,
    },
  });
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUserStatus,
  approveDoctor,
  deleteUser,
  getAllAppointments,
  getAppointmentStats,
  getAuditLogs,
  getNotificationStats,
  getSystemHealth,
  getDashboardSummary,
};
