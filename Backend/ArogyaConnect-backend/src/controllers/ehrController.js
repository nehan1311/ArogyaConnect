const { AuditLog } = require("../models/AuditLog");
const EHR = require("../models/EHR");
const ehrService = require("../services/ehrService");

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getMyEHR = async (req, res) => {
  const ehr = await ehrService.getEHRForUser({
    patientId: req.user.id,
    requesterId: req.user.id,
    requesterRole: req.user.role,
    req,
  });

  res.status(200).json({
    success: true,
    ehr,
  });
};

const getPatientEHR = async (req, res) => {
  const ehr = await ehrService.getEHRForUser({
    patientId: req.params.patientId,
    requesterId: req.user.id,
    requesterRole: req.user.role,
    rawShareToken: req.query.shareToken,
    req,
  });

  res.status(200).json({
    success: true,
    ehr,
  });
};

const addEntry = async (req, res) => {
  const { type, title, content, appointmentId } = req.body;

  if (!type || !title || !content) {
    throw createError("Type, title, and content are required", 400);
  }

  const entry = await ehrService.addEHREntry({
    patientId: req.params.patientId,
    doctorId: req.user.id,
    appointmentId,
    type,
    title,
    content,
  });

  res.status(201).json({
    success: true,
    entry,
  });
};

const generateShareToken = async (req, res) => {
  const { grantedToId, expiryHours = 48 } = req.body;

  if (!grantedToId) {
    throw createError("grantedToId is required", 400);
  }

  const ehr = await ehrService.getOrCreateEHR(req.user.id);
  const result = await ehrService.generateShareToken({
    ehrId: ehr._id,
    patientId: req.user.id,
    grantedToId,
    expiryHours,
  });

  res.status(200).json({
    success: true,
    message: `Share this token with your doctor. It expires in ${expiryHours} hours.`,
    shareToken: result.rawToken,
    expiresAt: result.expiresAt,
  });
};

const revokeShareToken = async (req, res) => {
  const ehr = await ehrService.getOrCreateEHR(req.user.id);
  await ehrService.revokeShareToken({
    ehrId: ehr._id,
    patientId: req.user.id,
    tokenId: req.params.tokenId,
  });

  res.status(200).json({
    success: true,
    message: "Access revoked.",
  });
};

const getAuditLogs = async (req, res) => {
  const { patientId } = req.params;
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.max(Number(req.query.limit) || 20, 1);
  const skip = (page - 1) * limit;

  if (req.user.role === "PATIENT" && req.user.id !== patientId) {
    throw createError("Access denied", 403);
  }

  if (!["PATIENT", "ADMIN"].includes(req.user.role)) {
    throw createError("Access denied", 403);
  }

  const [logs, total] = await Promise.all([
    AuditLog.find({ patient: patientId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    AuditLog.countDocuments({ patient: patientId }),
  ]);

  res.status(200).json({
    success: true,
    count: logs.length,
    total,
    logs,
  });
};

module.exports = {
  getMyEHR,
  getPatientEHR,
  addEntry,
  generateShareToken,
  revokeShareToken,
  getAuditLogs,
};
