const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "APPOINTMENT_CONFIRMATION",
        "APPOINTMENT_CANCELLATION",
        "APPOINTMENT_REMINDER_1HR",
        "APPOINTMENT_REMINDER_15MIN",
        "PASSWORD_RESET",
        "PRESCRIPTION_ISSUED",
        "TRIAGE_CRITICAL_ALERT",
        "GENERAL",
      ],
      required: true,
    },
    channel: {
      type: String,
      enum: ["EMAIL", "SMS", "BOTH"],
      required: true,
    },
    subject: String,
    message: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["SENT", "FAILED", "PENDING"],
      default: "PENDING",
    },
    errorMessage: String,
    relatedAppointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Notification", notificationSchema);
