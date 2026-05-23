const VideoSession = require("../models/VideoSession");
const Appointment = require("../models/Appointment");
const { createAuditLog } = require("../models/AuditLog");
const ehrService = require("./ehrService");

const createError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const generateRoomName = (appointmentId) => "appt-" + appointmentId.toString();

const getJitsiDomain = () =>
  (process.env.JITSI_DOMAIN || "meet.jit.si").replace(/^https?:\/\//, "");

const generateRoomUrl = (roomName) =>
  "https://" + getJitsiDomain() + "/" + encodeURIComponent(roomName);

const getSessionRoomName = (session) =>
  session.roomName || session.dailyRoomName || generateRoomName(session.appointment);

const getSessionRoomUrl = (session) =>
  session.roomUrl || session.dailyRoomUrl || generateRoomUrl(getSessionRoomName(session));

const createVideoRoom = async ({ appointmentId, doctorId }) => {
  const appointment = await Appointment.findById(appointmentId)
    .populate("patient", "name email")
    .populate("doctor", "name email");

  if (!appointment) throw createError("Appointment not found", 404);
  if (appointment.doctor._id.toString() !== doctorId.toString()) {
    throw createError("Not your appointment", 403);
  }
  if (appointment.status !== "CONFIRMED") {
    throw createError(
      "Appointment must be CONFIRMED before starting video session",
      400
    );
  }

  const existing = await VideoSession.findOne({ appointment: appointmentId });
  if (existing && ["CREATED", "ACTIVE"].includes(existing.status)) {
    existing.provider = "JITSI";
    existing.roomName = getSessionRoomName(existing);
    existing.roomUrl = getSessionRoomUrl(existing);
    await existing.save();

    return {
      videoSession: existing,
      roomUrl: existing.roomUrl,
      roomName: existing.roomName,
    };
  }

  const roomName = generateRoomName(appointmentId);
  const roomUrl = generateRoomUrl(roomName);

  const videoSession = await VideoSession.create({
    appointment: appointmentId,
    patient: appointment.patient._id,
    doctor: doctorId,
    provider: "JITSI",
    roomName,
    roomUrl,
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
    roomUrl,
    roomName,
  };
};

const joinVideoRoom = async ({ appointmentId, userId, userRole }) => {
  const session = await VideoSession.findOne({ appointment: appointmentId });
  if (!session) {
    throw createError(
      "Video room not created yet. Ask the doctor to start the session.",
      404
    );
  }

  const isParticipant =
    session.patient.toString() === userId.toString() ||
    session.doctor.toString() === userId.toString();
  if (!isParticipant) throw createError("Access denied", 403);

  if (!["CREATED", "ACTIVE"].includes(session.status)) {
    throw createError("Session has ended", 400);
  }

  if (userRole === "DOCTOR") {
    session.doctorJoinedAt = Date.now();
    session.status = "ACTIVE";
    session.startedAt = session.startedAt || Date.now();
  } else {
    session.patientJoinedAt = Date.now();
  }

  session.provider = "JITSI";
  session.roomName = getSessionRoomName(session);
  session.roomUrl = getSessionRoomUrl(session);
  await session.save();

  return {
    roomUrl: session.roomUrl,
    roomName: session.roomName,
    sessionId: session._id,
    status: session.status,
  };
};

const endVideoSession = async ({ appointmentId, endedById }) => {
  const session = await VideoSession.findOne({ appointment: appointmentId });
  if (!session) throw createError("Video session not found", 404);

  const isParticipant =
    session.patient.toString() === endedById.toString() ||
    session.doctor.toString() === endedById.toString();
  if (!isParticipant) throw createError("Access denied", 403);

  if (session.status === "ENDED") {
    return { session, durationMinutes: session.durationMinutes };
  }

  const durationMinutes = session.startedAt
    ? Math.round((Date.now() - session.startedAt) / 60000)
    : 0;

  session.status = "ENDED";
  session.endedAt = Date.now();
  session.durationMinutes = durationMinutes;
  session.endedBy = endedById;
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
        "Video consultation completed via Jitsi. Duration: " +
        durationMinutes +
        " minutes.",
    });
  } catch (_) {
    // fire and forget
  }

  return { session, durationMinutes };
};

const getSessionByAppointment = async ({
  appointmentId,
  requesterId,
  requesterRole,
}) => {
  const session = await VideoSession.findOne({ appointment: appointmentId }).lean();

  if (!session) throw createError("Video session not found", 404);

  const isParticipant =
    session.patient.toString() === requesterId.toString() ||
    session.doctor.toString() === requesterId.toString();

  if (!isParticipant && requesterRole !== "ADMIN") {
    throw createError("Access denied", 403);
  }

  return {
    ...session,
    provider: session.provider || "JITSI",
    roomName: session.roomName || session.dailyRoomName,
    roomUrl:
      session.roomUrl ||
      session.dailyRoomUrl ||
      generateRoomUrl(session.roomName || session.dailyRoomName),
  };
};

module.exports = {
  createVideoRoom,
  joinVideoRoom,
  endVideoSession,
  getSessionByAppointment,
};
