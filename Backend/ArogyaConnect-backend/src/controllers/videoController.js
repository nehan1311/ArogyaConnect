const videoService = require("../services/videoService");

const createError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};


const createRoom = async (req, res) => {
  const { appointmentId } = req.body;
  if (!appointmentId) throw createError("appointmentId is required", 400);

  const { videoSession, roomUrl, roomName } =
    await videoService.createVideoRoom({ appointmentId, doctorId: req.user.id });

  res.status(201).json({
    success: true,
    message: "Jitsi consultation room ready.",
    roomUrl,
    roomName,
    sessionId: videoSession._id,
    provider: "JITSI",
    instructions: "Doctor and patient can both open roomUrl to join the call.",
  });
};


const joinRoom = async (req, res) => {
  const { appointmentId } = req.body;
  if (!appointmentId) throw createError("appointmentId is required", 400);

  const { roomUrl, roomName, sessionId, status } =
    await videoService.joinVideoRoom({
      appointmentId,
      userId: req.user.id,
      userRole: req.user.role,
    });

  res.status(200).json({
    success: true,
    roomUrl,
    roomName,
    sessionId,
    status,
    provider: "JITSI",
    message: "Open roomUrl in the browser to join the video call.",
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
