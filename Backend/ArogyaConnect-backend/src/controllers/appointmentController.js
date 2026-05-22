const Appointment = require("../models/Appointment");
const DoctorAvailability = require("../models/DoctorAvailability");
const User = require("../models/User");
const appointmentService = require("../services/appointmentService");

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const searchDoctors = async (req, res) => {
  const { specialization, name, date } = req.query;
  const query = {
    role: "DOCTOR",
    isApproved: true,
    isActive: true,
  };

  if (specialization) {
    query["profile.specialization"] = {
      $regex: specialization,
      $options: "i",
    };
  }

  if (name) {
    query.name = {
      $regex: name,
      $options: "i",
    };
  }

  const doctors = await User.find(query).select(
    "name email profile.specialization profile.phone"
  );

  const formattedDoctors = await Promise.all(
    doctors.map(async (doctor) => ({
      id: doctor._id.toString(),
      name: doctor.name,
      email: doctor.email,
      profile: {
        specialization: doctor.profile?.specialization,
        phone: doctor.profile?.phone,
      },
      availableSlots: date
        ? await appointmentService.getDoctorSlots(doctor._id.toString(), date)
        : [],
    }))
  );

  res.status(200).json({
    success: true,
    count: formattedDoctors.length,
    doctors: formattedDoctors,
  });
};

const getDoctorAvailability = async (req, res) => {
  const { date } = req.query;

  if (!date) {
    throw createError("Date is required", 400);
  }

  const slots = await appointmentService.getDoctorSlots(req.params.doctorId, date);

  res.status(200).json({
    success: true,
    date,
    slots,
  });
};

const setDoctorAvailability = async (req, res) => {
  const { weeklySchedule = [], blockedDates = [] } = req.body;

  const availability = await DoctorAvailability.findOneAndUpdate(
    { doctor: req.user.id },
    {
      $set: {
        weeklySchedule,
        blockedDates,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  res.status(200).json({
    success: true,
    availability,
  });
};

const bookAppointment = async (req, res) => {
  const { doctorId, date, startTime, notes } = req.body;

  if (!doctorId || !date || !startTime || !notes) {
    throw createError("Doctor, date, start time, and notes are required", 400);
  }

  const appointment = await appointmentService.bookAppointment({
    patientId: req.user.id,
    doctorId,
    date,
    startTime,
    notes,
  });

  let notificationService = null;

  try {
    notificationService = require("../services/notificationService");
  } catch (error) {
    if (
      error.code !== "MODULE_NOT_FOUND" ||
      !error.message.includes("notificationService")
    ) {
      throw error;
    }
  }

  if (
    notificationService &&
    typeof notificationService.sendAppointmentBookedNotification === "function"
  ) {
    try {
      await notificationService.sendAppointmentBookedNotification(appointment);
    } catch (error) {
    }
  }

  res.status(201).json({
    success: true,
    appointment,
  });
};

const getMyAppointments = async (req, res) => {
  const query = {};

  if (req.user.role === "PATIENT") {
    query.patient = req.user.id;
  }

  if (req.user.role === "DOCTOR") {
    query.doctor = req.user.id;
  }

  if (req.query.status) {
    query.status = req.query.status;
  }

  const appointments = await Appointment.find(query)
    .populate("patient", "name email")
    .populate("doctor", "name email profile.specialization")
    .sort({ date: -1, startTime: -1 });

  res.status(200).json({
    success: true,
    count: appointments.length,
    appointments,
  });
};

const getAppointmentById = async (req, res) => {
  const appointment = await Appointment.findById(req.params.id)
    .populate("patient", "name email")
    .populate("doctor", "name email profile.specialization");

  if (!appointment) {
    throw createError("Appointment not found", 404);
  }

  const isPatient = appointment.patient._id.toString() === req.user.id;
  const isDoctor = appointment.doctor._id.toString() === req.user.id;
  const isAdmin = req.user.role === "ADMIN";

  if (!isPatient && !isDoctor && !isAdmin) {
    throw createError("Access denied", 403);
  }

  res.status(200).json({
    success: true,
    appointment,
  });
};

const cancelAppointment = async (req, res) => {
  const appointment = await appointmentService.cancelAppointment({
    appointmentId: req.params.id,
    userId: req.user.id,
    role: req.user.role,
    reason: req.body.reason,
  });

  res.status(200).json({
    success: true,
    appointment,
  });
};

const updateConsultationNotes = async (req, res) => {
  const { consultationNotes } = req.body;

  if (consultationNotes === undefined) {
    throw createError("Consultation notes are required", 400);
  }

  const appointment = await Appointment.findById(req.params.id)
    .populate("patient", "name email")
    .populate("doctor", "name email profile.specialization");

  if (!appointment) {
    throw createError("Appointment not found", 404);
  }

  if (appointment.doctor._id.toString() !== req.user.id) {
    throw createError("Access denied", 403);
  }

  appointment.consultationNotes = consultationNotes;

  if (appointment.status === "CONFIRMED") {
    appointment.status = "IN_PROGRESS";
  }

  await appointment.save();

  res.status(200).json({
    success: true,
    appointment,
  });
};

module.exports = {
  searchDoctors,
  getDoctorAvailability,
  setDoctorAvailability,
  bookAppointment,
  getMyAppointments,
  getAppointmentById,
  cancelAppointment,
  updateConsultationNotes,
};
