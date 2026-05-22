const mongoose = require("mongoose");

const weeklyScheduleSchema = new mongoose.Schema(
  {
    dayOfWeek: {
      type: Number,
      min: 0,
      max: 6,
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
    slotDurationMinutes: {
      type: Number,
      default: 30,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const doctorAvailabilitySchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    weeklySchedule: [weeklyScheduleSchema],
    blockedDates: [Date],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "DoctorAvailability",
  doctorAvailabilitySchema
);
