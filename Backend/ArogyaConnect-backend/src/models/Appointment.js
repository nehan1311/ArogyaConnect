const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: [
        "REQUESTED",
        "CONFIRMED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
      ],
      default: "CONFIRMED",
    },
    cancellationReason: String,
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    notes: String,
    consultationNotes: String,
    videoRoomId: String,
    prescription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Prescription",
    },
    reminderSent: {
      oneHour: {
        type: Boolean,
        default: false,
      },
      fifteenMin: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
  }
);

appointmentSchema.index({ doctor: 1, date: 1, startTime: 1 }, { unique: true });
appointmentSchema.index({ patient: 1, date: 1 });
appointmentSchema.index({ status: 1 });

module.exports = mongoose.model("Appointment", appointmentSchema);
