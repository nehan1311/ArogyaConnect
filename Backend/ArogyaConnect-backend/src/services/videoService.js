const axios = require("axios");

const VideoSession = require("../models/VideoSession");
const Appointment = require("../models/Appointment");
const { createAuditLog } = require("../models/AuditLog");
const ehrService = require("./ehrService");

const createError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};


const dailyAxios = () =>
  axios.create({
    baseURL: "https://api.daily.co/v1",
    headers: { Authorization: "Bearer " + process.env.DAILY_API_KEY },
  });

const generateRoomName = (appointmentId) => "appt-" + appointmentId.toString();


const generateRoomUrl = (roomName) =>
  "https://" + process.env.DAILY_DOMAIN + ".daily.co/" + roomName;

const createDailyRoom = async (roomName) => {
  try {
    const { data } = await dailyAxios().post("/rooms", {
      name: roomName,
      privacy: "private",
      properties: {
        max_participants: 2,
        enable_chat: true,
        enable_screenshare: false,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
        eject_at_room_exp: true,
      },
    });
    return data;
  } catch (err) {
    const msg =
      err.response && err.response.data && err.response.data.error
        ? err.response.data.error
        : err.message;
    throw createError("Daily.co room creation failed: " + msg, 502);
  }
};


const createMeetingToken = async ({ roomName, userId, userName, isOwner }) => {
  const { data } = await dailyAxios().post("/meeting-tokens", {
    properties: {
      room_name: roomName,
      user_name: userName,
      user_id: userId.toString(),
      is_owner: isOwner,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 4,
      enable_screenshare: false,
      start_video_off: false,
      start_audio_off: false,
    },
  });
  return data.token;
};

const deleteDailyRoom = async (roomName) => {
  try {
    await dailyAxios().delete("/rooms/" + roomName);
  } catch (_) {
    // silently ignore — room may already be deleted
  }
};

// ── 1. createVideoRoom ────────────────────────────────────────────
const createVideoRoom = async ({ appointmentId, doctorId }) => {
  const appointment = await Appointment.findById(appointmentId)
    .populate("patient", "name email")
    .populate("doctor", "name email");

  if (!appointment) throw createError("Appointment not found", 404);
  if (appointment.doctor._id.toString() !== doctorId.toString())
    throw createError("Not your appointment", 403);
  if (appointment.status !== "CONFIRMED")
    throw createError(
      "Appointment must be CONFIRMED before starting video session",
      400
    );

  // Idempotent — regenerate tokens if session already exists
  const existing = await VideoSession.findOne({ appointment: appointmentId });
  if (existing && ["CREATED", "ACTIVE"].includes(existing.status)) {
    const doctorToken = await createMeetingToken({
      roomName: existing.dailyRoomName,
      userId: doctorId,
      userName: "Dr. " + appointment.doctor.name,
      isOwner: true,
    });
    const patientToken = await createMeetingToken({
      roomName: existing.dailyRoomName,
      userId: appointment.patient._id,
      userName: appointment.patient.name,
      isOwner: false,
    });
    existing.doctorToken = doctorToken;
    existing.patientToken = patientToken;
    await existing.save();
    return {
      videoSession: existing,
      roomUrl: existing.dailyRoomUrl,
      doctorToken,
      patientToken,
      roomName: existing.dailyRoomName,
    };
  }

  const roomName = generateRoomName(appointmentId);
  await createDailyRoom(roomName);

  const doctorToken = await createMeetingToken({
    roomName,
    userId: doctorId,
    userName: "Dr. " + appointment.doctor.name,
    isOwner: true,
  });
  const patientToken = await createMeetingToken({
    roomName,
    userId: appointment.patient._id,
    userName: appointment.patient.name,
    isOwner: false,
  });

  const videoSession = await VideoSession.create({
    appointment: appointmentId,
    patient: appointment.patient._id,
    doctor: doctorId,
    dailyRoomName: roomName,
    dailyRoomUrl: generateRoomUrl(roomName),
    patientToken,
    doctorToken,
    status: "CREATED",
  });

  appointment.videoRoomId = videoSession._id;
  appointment.status = "IN_PROGRESS";
  await appointment.save();

  await createAuditLog({
    actor: doctorId,
    actorRole: "DOCTOR",
    action: "APPOINTMENT_CREATE",
    targetResource: "VideoSession",
    targetId: videoSession._id,
    patient: appointment.patient._id,
  });

  return {
    videoSession,
    roomUrl: videoSession.dailyRoomUrl,
    doctorToken,
    patientToken,
    roomName,
  };
};

// ── 2. joinVideoRoom ──────────────────────────────────────────────
const joinVideoRoom = async ({ appointmentId, userId, userRole, userName }) => {
  const session = await VideoSession.findOne({ appointment: appointmentId });
  if (!session)
    throw createError(
      "Video room not created yet. Ask the doctor to start the session.",
      404
    );

  const isParticipant =
    session.patient.toString() === userId.toString() ||
    session.doctor.toString() === userId.toString();
  if (!isParticipant) throw createError("Access denied", 403);

  if (!["CREATED", "ACTIVE"].includes(session.status))
    throw createError("Session has ended", 400);

  if (userRole === "DOCTOR") {
    session.doctorJoinedAt = Date.now();
    session.status = "ACTIVE";
    session.startedAt = session.startedAt || Date.now();
  } else {
    session.patientJoinedAt = Date.now();
  }
  await session.save();

  const token = await createMeetingToken({
    roomName: session.dailyRoomName,
    userId,
    userName,
    isOwner: userRole === "DOCTOR",
  });

  return {
    token,
    roomUrl: session.dailyRoomUrl,
    roomName: session.dailyRoomName,
    sessionId: session._id,
    status: session.status,
  };
};

// ── 3. endVideoSession ────────────────────────────────────────────
const endVideoSession = async ({ appointmentId, endedById }) => {
  const session = await VideoSession.findOne({ appointment: appointmentId });
  if (!session) throw createError("Video session not found", 404);

  const isParticipant =
    session.patient.toString() === endedById.toString() ||
    session.doctor.toString() === endedById.toString();
  if (!isParticipant) throw createError("Access denied", 403);

  if (session.status === "ENDED") return { session, durationMinutes: session.durationMinutes };

  await deleteDailyRoom(session.dailyRoomName);

  const durationMinutes = session.startedAt
    ? Math.round((Date.now() - session.startedAt) / 60000)
    : 0;

  session.status = "ENDED";
  session.endedAt = Date.now();
  session.durationMinutes = durationMinutes;
  session.endedBy = endedById;
  session.patientToken = null;
  session.doctorToken = null;
  await session.save();

  await Appointment.findByIdAndUpdate(appointmentId, { status: "COMPLETED" });

  try {
    await ehrService.addEHREntry({
      patientId: session.patient,
      doctorId: session.doctor,
      appointmentId: session.appointment,
      type: "CONSULTATION",
      title: "Video Consultation Completed",
      content:
        "Video consultation completed via Daily.co. Duration: " +
        durationMinutes +
        " minutes.",
    });
  } catch (_) {
    // fire and forget
  }

  return { session, durationMinutes };
};

// ── 4. getSessionByAppointment ────────────────────────────────────
const getSessionByAppointment = async ({
  appointmentId,
  requesterId,
  requesterRole,
}) => {
  const session = await VideoSession.findOne({ appointment: appointmentId })
    .select("-patientToken -doctorToken")
    .lean();

  if (!session) throw createError("Video session not found", 404);

  const isParticipant =
    session.patient.toString() === requesterId.toString() ||
    session.doctor.toString() === requesterId.toString();

  if (!isParticipant && requesterRole !== "ADMIN")
    throw createError("Access denied", 403);

  return session;
};

module.exports = {
  createVideoRoom,
  joinVideoRoom,
  endVideoSession,
  getSessionByAppointment,
};
