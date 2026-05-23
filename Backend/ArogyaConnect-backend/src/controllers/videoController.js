const User = require("../models/User");
const videoService = require("../services/videoService");

const createError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};


const createRoom = async (req, res) => {
  const { appointmentId } = req.body;
  if (!appointmentId) throw createError("appointmentId is required", 400);

  const { videoSession, roomUrl, roomName, doctorToken, patientToken } =
    await videoService.createVideoRoom({ appointmentId, doctorId: req.user.id });

  res.status(201).json({
    success: true,
    message: "Video room ready. Share the room URL with your patient.",
    roomUrl,
    roomName,
    doctorToken,
    patientToken,
    sessionId: videoSession._id,
    instructions:
      "Doctor: use doctorToken. Patient: use patientToken. Both open roomUrl.",
  });
};


const joinRoom = async (req, res) => {
  const { appointmentId } = req.body;
  if (!appointmentId) throw createError("appointmentId is required", 400);

  const user = await User.findById(req.user.id).select("name role");
  const userName = user.role === "DOCTOR" ? "Dr. " + user.name : user.name;

  const { token, roomUrl, roomName, sessionId, status } =
    await videoService.joinVideoRoom({
      appointmentId,
      userId: req.user.id,
      userRole: req.user.role,
      userName,
    });

  res.status(200).json({
    success: true,
    token,
    roomUrl,
    roomName,
    sessionId,
    status,
    message: "Open roomUrl in browser with this token to join the video call.",
  });
};

const endSession = async (req, res) => {
  const { appointmentId } = req.body;
  if (!appointmentId) throw createError("appointmentId is required", 400);

  const { durationMinutes } = await videoService.endVideoSession({
    appointmentId,
    endedById: req.user.id,
  });

  res.status(200).json({
    success: true,
    message: "Video session ended successfully.",
    durationMinutes,
    appointmentStatus: "COMPLETED",
  });
};

const getSession = async (req, res) => {
  const session = await videoService.getSessionByAppointment({
    appointmentId: req.params.appointmentId,
    requesterId: req.user.id,
    requesterRole: req.user.role,
  });

  res.status(200).json({ success: true, session });
};

module.exports = { createRoom, joinRoom, endSession, getSession };
