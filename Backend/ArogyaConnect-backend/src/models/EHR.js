const mongoose = require("mongoose");

const attachmentSchema = new mongoose.Schema(
  {
    fileName: String,
    fileUrl: String,
    fileType: String,
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const entrySchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      default: Date.now,
    },
    type: {
      type: String,
      enum: [
        "CONSULTATION",
        "DIAGNOSIS",
        "LAB_REPORT",
        "PRESCRIPTION",
        "VACCINATION",
        "GENERAL_NOTE",
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    doctorName: String,
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
    },
    attachments: [attachmentSchema],
    isEncrypted: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true }
);

const shareTokenSchema = new mongoose.Schema(
  {
    token: String,
    grantedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    expiresAt: Date,
    isRevoked: {
      type: Boolean,
      default: false,
    },
    accessedAt: Date,
  },
  { _id: true }
);

const ehrSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "UNKNOWN"],
      default: "UNKNOWN",
    },
    allergies: [String],
    chronicConditions: [String],
    entries: [entrySchema],
    shareTokens: [shareTokenSchema],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("EHR", ehrSchema);
