const crypto = require("crypto");

const Appointment = require("../models/Appointment");
const EHR = require("../models/EHR");
const User = require("../models/User");
const { createAuditLog } = require("../models/AuditLog");

const ALGORITHM = "aes-256-cbc";
const KEY = Buffer.from(process.env.EHR_ENCRYPTION_KEY || "", "hex");

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const validateEncryptionKey = () => {
  if (KEY.length !== 32) {
    throw createError("EHR encryption key is invalid", 500);
  }
};

const encrypt = (text) => {
  validateEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encryptedData = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);
  return `${iv.toString("hex")}:${encryptedData.toString("hex")}`;
};

const decrypt = (encryptedText) => {
  try {
    validateEncryptionKey();
    const [ivHex, encryptedHex] = encryptedText.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const encryptedData = Buffer.from(encryptedHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch (error) {
    throw new Error("Decryption failed");
  }
};

const getOrCreateEHR = async (patientId) => {
  let ehr = await EHR.findOne({ patient: patientId });

  if (!ehr) {
    ehr = await EHR.create({
      patient: patientId,
      entries: [],
      shareTokens: [],
    });
  }

  return ehr;
};

const formatEHRForResponse = (ehr) => {
  try {
    const ehrObject = ehr.toObject();
    ehrObject.entries = ehrObject.entries.map((entry) => ({
      ...entry,
      content: decrypt(entry.content),
    }));
    ehrObject.shareTokens = (ehrObject.shareTokens || []).map((token) => ({
      _id: token._id,
      grantedTo: token.grantedTo,
      grantedBy: token.grantedBy,
      expiresAt: token.expiresAt,
      isRevoked: token.isRevoked,
      accessedAt: token.accessedAt,
    }));
    return ehrObject;
  } catch (error) {
    throw createError("Data integrity error", 500);
  }
};

const hasDoctorRelationship = async (doctorId, patientId, statuses) =>
  Appointment.exists({
    doctor: doctorId,
    patient: patientId,
    status: { $in: statuses },
  });

const getEHRForUser = async ({
  patientId,
  requesterId,
  requesterRole,
  rawShareToken,
  req,
}) => {
  let accessMethod = "denied";
  const ehr = await getOrCreateEHR(patientId);

  if (requesterRole === "PATIENT" && requesterId === patientId) {
    accessMethod = "patient";
  } else if (requesterRole === "DOCTOR" && !rawShareToken) {
    const hasAccess = await hasDoctorRelationship(requesterId, patientId, [
      "CONFIRMED",
      "COMPLETED",
    ]);

    if (!hasAccess) {
      throw createError("No active appointment with this patient", 403);
    }

    accessMethod = "appointment";
  } else if (rawShareToken) {
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawShareToken)
      .digest("hex");
    const matchedToken = ehr.shareTokens.find(
      (token) =>
        token.token === hashedToken &&
        token.isRevoked === false &&
        token.expiresAt &&
        token.expiresAt > new Date()
    );

    if (!matchedToken) {
      throw createError("Invalid or expired share token", 403);
    }

    if (
      matchedToken.grantedTo &&
      matchedToken.grantedTo.toString() !== requesterId
    ) {
      throw createError("Invalid or expired share token", 403);
    }

    matchedToken.accessedAt = new Date();
    await ehr.save();
    accessMethod = "shareToken";
  } else if (requesterRole === "ADMIN") {
    accessMethod = "admin";
  } else {
    throw createError("Access denied", 403);
  }

  await createAuditLog({
    actor: requesterId,
    actorRole: requesterRole,
    action: "EHR_VIEW",
    targetResource: "EHR",
    targetId: ehr._id,
    patient: patientId,
    metadata: {
      accessMethod,
    },
    ipAddress: req && req.ip,
    userAgent: req && req.get ? req.get("user-agent") : undefined,
  });

  return formatEHRForResponse(ehr);
};

const addEHREntry = async ({
  patientId,
  doctorId,
  appointmentId,
  type,
  title,
  content,
}) => {
  const actor = await User.findById(doctorId).select("name role");

  if (!actor || !["DOCTOR", "ADMIN"].includes(actor.role)) {
    throw createError("Access denied", 403);
  }

  if (actor.role === "DOCTOR") {
    const hasAccess = await hasDoctorRelationship(doctorId, patientId, [
      "CONFIRMED",
      "IN_PROGRESS",
      "COMPLETED",
    ]);

    if (!hasAccess) {
      throw createError("No active appointment with this patient", 403);
    }
  }

  const ehr = await getOrCreateEHR(patientId);
  const action = ehr.entries.length === 0 ? "EHR_CREATE" : "EHR_UPDATE";

  const entry = {
    type,
    title,
    content: encrypt(content),
    doctorId,
    doctorName: actor.name,
    appointmentId,
    isEncrypted: true,
  };

  ehr.entries.push(entry);
  await ehr.save();

  const createdEntry = ehr.entries[ehr.entries.length - 1].toObject();
  createdEntry.content = content;

  await createAuditLog({
    actor: doctorId,
    actorRole: actor.role,
    action,
    targetResource: "EHR",
    targetId: ehr._id,
    patient: patientId,
    metadata: {
      entryId: createdEntry._id,
      type,
      title,
      appointmentId,
    },
  });

  return createdEntry;
};

const generateShareToken = async ({
  ehrId,
  patientId,
  grantedToId,
  expiryHours,
}) => {
  const doctor = await User.findById(grantedToId).select("role");

  if (!doctor || doctor.role !== "DOCTOR") {
    throw createError("Invalid doctor for share access", 400);
  }

  const ehr = ehrId
    ? await EHR.findOne({ _id: ehrId, patient: patientId })
    : await getOrCreateEHR(patientId);

  if (!ehr) {
    throw createError("EHR not found", 404);
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");
  const expiresAt = new Date(
    Date.now() + (expiryHours || 48) * 60 * 60 * 1000
  );

  ehr.shareTokens.push({
    token: hashedToken,
    grantedTo: grantedToId,
    grantedBy: patientId,
    expiresAt,
    isRevoked: false,
  });
  await ehr.save();

  await createAuditLog({
    actor: patientId,
    actorRole: "PATIENT",
    action: "EHR_SHARE",
    targetResource: "EHR",
    targetId: ehr._id,
    patient: patientId,
    metadata: {
      grantedTo: grantedToId,
      expiresAt,
    },
  });

  return {
    rawToken,
    expiresAt,
    ehr,
  };
};

const revokeShareToken = async ({ ehrId, patientId, tokenId }) => {
  const ehr = ehrId
    ? await EHR.findOne({ _id: ehrId, patient: patientId })
    : await EHR.findOne({ patient: patientId });

  if (!ehr) {
    throw createError("EHR not found", 404);
  }

  const shareToken = ehr.shareTokens.id(tokenId);

  if (!shareToken) {
    throw createError("Share token not found", 404);
  }

  shareToken.isRevoked = true;
  await ehr.save();

  return ehr;
};

module.exports = {
  encrypt,
  decrypt,
  getOrCreateEHR,
  getEHRForUser,
  addEHREntry,
  generateShareToken,
  revokeShareToken,
};
