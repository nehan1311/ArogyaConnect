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
    dailyRoomName: { type: String, required: true },
    dailyRoomUrl: { type: String, required: true },
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
    patientToken: String,
    doctorToken: String,
    consentGiven: { type: Boolean, default: false },
    endedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);


module.exports = mongoose.model("VideoSession", videoSessionSchema);
