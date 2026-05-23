const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    actorRole: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      enum: [
        "EHR_VIEW",
        "EHR_CREATE",
        "EHR_UPDATE",
        "EHR_SHARE",
        "EHR_SHARE_ACCESS",
        "PRESCRIPTION_CREATE",
        "APPOINTMENT_CREATE",
        "APPOINTMENT_CANCEL",
        "LOGIN",
        "LOGOUT",
        "PASSWORD_RESET",
        "ADMIN_USER_UPDATE",
      ],
      required: true,
    },
    targetResource: {
      type: String,
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    metadata: mongoose.Schema.Types.Mixed,
    ipAddress: String,
    userAgent: String,
  },
  {
    timestamps: true,
  }
);

const blockMutation = () => {
  throw new Error("AuditLog is append-only. Updates are not allowed.");
};

auditLogSchema.pre(["updateOne", "findOneAndUpdate", "updateMany"], blockMutation);
auditLogSchema.pre(["deleteOne", "deleteMany", "findOneAndDelete"], blockMutation);

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

const createAuditLog = async ({
  actor,
  actorRole,
  action,
  targetResource,
  targetId,
  patient,
  metadata,
  ipAddress,
  userAgent,
}) => {
  try {
    await AuditLog.create({
      actor,
      actorRole,
      action,
      targetResource,
      targetId,
      patient,
      metadata,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
};

module.exports = {
  AuditLog,
  createAuditLog,
};
