const mongoose = require("mongoose");

const Appointment = require("../models/Appointment");
const DoctorAvailability = require("../models/DoctorAvailability");
const User = require("../models/User");

const ACTIVE_BOOKING_STATUSES = ["CONFIRMED", "IN_PROGRESS"];

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const pad = (value) => value.toString().padStart(2, "0");

const formatDateKey = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const parseDateOnly = (dateString) => {
  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    throw createError("Invalid date", 400);
  }

  return date;
};

const getDayBounds = (dateString) => {
  const dayStart = parseDateOnly(dateString);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return { dayStart, dayEnd };
};

const timeToMinutes = (timeString) => {
  const [hours, minutes] = timeString.split(":").map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${pad(hours)}:${pad(minutes)}`;
};

const isBlockedDate = (blockedDates, dateString) =>
  blockedDates.some((blockedDate) => formatDateKey(new Date(blockedDate)) === dateString);

const getMatchingSchedule = (availability, dateString) => {
  const targetDate = parseDateOnly(dateString);
  const dayOfWeek = targetDate.getDay();
  return availability.weeklySchedule.find(
    (schedule) => schedule.dayOfWeek === dayOfWeek
  );
};

const generateSlotsFromSchedule = (schedule) => {
  if (!schedule || schedule.isAvailable === false) {
    return [];
  }

  const startMinutes = timeToMinutes(schedule.startTime);
  const endMinutes = timeToMinutes(schedule.endTime);
  const slotDuration = schedule.slotDurationMinutes || 30;

  if (startMinutes >= endMinutes || slotDuration <= 0) {
    return [];
  }

  const slots = [];

  for (
    let currentMinutes = startMinutes;
    currentMinutes + slotDuration <= endMinutes;
    currentMinutes += slotDuration
  ) {
    slots.push({
      startTime: minutesToTime(currentMinutes),
      endTime: minutesToTime(currentMinutes + slotDuration),
    });
  }

  return slots;
};

const loadAvailableSlots = async (doctorId, dateString, options = {}) => {
  const { session } = options;
  const availability = await DoctorAvailability.findOne({ doctor: doctorId }).session(
    session || null
  );

  if (!availability) {
    return [];
  }

  if (isBlockedDate(availability.blockedDates || [], dateString)) {
    return [];
  }

  const schedule = getMatchingSchedule(availability, dateString);
  const generatedSlots = generateSlotsFromSchedule(schedule);

  if (generatedSlots.length === 0) {
    return [];
  }

  const { dayStart, dayEnd } = getDayBounds(dateString);
  const appointments = await Appointment.find({
    doctor: doctorId,
    date: { $gte: dayStart, $lt: dayEnd },
    status: { $in: ACTIVE_BOOKING_STATUSES },
  })
    .select("startTime")
    .session(session || null);

  const bookedStartTimes = new Set(
    appointments.map((appointment) => appointment.startTime)
  );

  return generatedSlots.filter(
    (slot) => !bookedStartTimes.has(slot.startTime)
  );
};

const populateAppointment = (appointmentId) =>
  Appointment.findById(appointmentId)
    .populate("patient", "name email")
    .populate("doctor", "name email");

const createAppointmentWithFallback = async (appointmentPayload) => {
  try {
    const result = await Appointment.collection.findOneAndUpdate(
      {
        doctor: new mongoose.Types.ObjectId(appointmentPayload.doctor),
        date: appointmentPayload.date,
        startTime: appointmentPayload.startTime,
        status: { $in: ACTIVE_BOOKING_STATUSES },
      },
      {
        $setOnInsert: {
          ...appointmentPayload,
          patient: new mongoose.Types.ObjectId(appointmentPayload.patient),
          doctor: new mongoose.Types.ObjectId(appointmentPayload.doctor),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        includeResultMetadata: true,
      }
    );

    if (result.lastErrorObject && result.lastErrorObject.updatedExisting) {
      throw createError("Slot not available", 409);
    }

    return populateAppointment(result.value._id);
  } catch (error) {
    if (error.code === 11000) {
      throw createError("Slot not available", 409);
    }

    throw error;
  }
};

const supportsTransactionFallback = (error) => {
  if (!error || !error.message) {
    return false;
  }

  return (
    error.message.includes(
      "Transaction numbers are only allowed on a replica set member or mongos"
    ) ||
    error.message.includes("Transaction support is not available")
  );
};

const getDoctorSlots = async (doctorId, dateString) =>
  loadAvailableSlots(doctorId, dateString);

const bookAppointment = async ({
  patientId,
  doctorId,
  date,
  startTime,
  notes,
}) => {
  const doctor = await User.findById(doctorId).select(
    "role isApproved isActive name email"
  );

  if (!doctor || doctor.role !== "DOCTOR") {
    throw createError("Doctor not found", 404);
  }

  if (doctor.isApproved !== true) {
    throw createError("Doctor is not approved", 403);
  }

  if (doctor.isActive === false) {
    throw createError("Doctor not found", 404);
  }

  const availableSlots = await getDoctorSlots(doctorId, date);
  const selectedSlot = availableSlots.find((slot) => slot.startTime === startTime);

  if (!selectedSlot) {
    throw createError("Slot not available", 409);
  }

  const appointmentDate = parseDateOnly(date);
  const appointmentPayload = {
    patient: patientId,
    doctor: doctorId,
    date: appointmentDate,
    startTime,
    endTime: selectedSlot.endTime,
    notes,
    status: "CONFIRMED",
  };

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const transactionSlots = await loadAvailableSlots(doctorId, date, { session });
    const transactionSlot = transactionSlots.find(
      (slot) => slot.startTime === startTime
    );

    if (!transactionSlot) {
      throw createError("Slot not available", 409);
    }

    const [appointment] = await Appointment.create([appointmentPayload], {
      session,
    });

    await session.commitTransaction();
    return populateAppointment(appointment._id);
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    if (error.code === 11000) {
      throw createError("Slot not available", 409);
    }

    if (supportsTransactionFallback(error)) {
      return createAppointmentWithFallback(appointmentPayload);
    }

    throw error;
  } finally {
    await session.endSession();
  }
};

const buildAppointmentDateTime = (dateValue, timeString) => {
  const date =
    typeof dateValue === "string" ? parseDateOnly(dateValue) : new Date(dateValue);
  return new Date(`${formatDateKey(date)}T${timeString}:00`);
};

const cancelAppointment = async ({ appointmentId, userId, role, reason }) => {
  const appointment = await Appointment.findById(appointmentId);

  if (!appointment) {
    throw createError("Appointment not found", 404);
  }

  const isPatient = appointment.patient.toString() === userId;
  const isDoctor = appointment.doctor.toString() === userId;
  const isAdmin = role === "ADMIN";

  if (!isPatient && !isDoctor && !isAdmin) {
    throw createError("Access denied", 403);
  }

  if (["CANCELLED", "COMPLETED"].includes(appointment.status)) {
    throw createError("Cannot cancel this appointment", 400);
  }

  if (role === "PATIENT") {
    const appointmentDateTime = buildAppointmentDateTime(
      appointment.date,
      appointment.startTime
    );
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);

    if (appointmentDateTime < twoHoursFromNow) {
      throw createError("Cannot cancel within 2 hours of appointment", 400);
    }
  }

  appointment.status = "CANCELLED";
  appointment.cancellationReason = reason;
  appointment.cancelledBy = userId;
  await appointment.save();

  return Appointment.findById(appointment._id)
    .populate("patient", "name email")
    .populate("doctor", "name email");
};

module.exports = {
  getDoctorSlots,
  bookAppointment,
  cancelAppointment,
};
