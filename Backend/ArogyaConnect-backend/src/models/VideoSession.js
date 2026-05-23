const mongoose = require("mongoose");


const videoSessionSchema = new mongoose.Schema(
  {
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
      unique: true,
    },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    provider: {
      type: String,
      enum: ["JITSI", "DAILY"],
      default: "JITSI",
    },
    roomName: { type: String, required: true },
    roomUrl: { type: String, required: true },
    dailyRoomName: String,
    dailyRoomUrl: String,
    status: {
      type: String,
      enum: ["CREATED", "ACTIVE", "ENDED"],
      default: "CREATED",
    },
    startedAt: Date,
    endedAt: Date,
    durationMinutes: Number,
    patientJoinedAt: Date,
    doctorJoinedAt: Date,
    consentGiven: { type: Boolean, default: false },
    endedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);


module.exports = mongoose.model("VideoSession", videoSessionSchema);
