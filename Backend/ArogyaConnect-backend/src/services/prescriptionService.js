const Appointment = require("../models/Appointment");
const Prescription = require("../models/Prescription");
const User = require("../models/User");
const { createAuditLog } = require("../models/AuditLog");
const ehrService = require("./ehrService");
const notificationService = require("./notificationService");

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const validateMedications = (medications) => {
  if (!Array.isArray(medications) || medications.length === 0) {
    throw createError("At least one medication is required", 400);
  }

  for (const medication of medications) {
    if (
      !medication.name ||
      !medication.dosage ||
      !medication.frequency ||
      !medication.duration
    ) {
      throw createError(
        "Each medication requires name, dosage, frequency, and duration",
        400
      );
    }
  }
};

const populatePrescription = (prescriptionId) =>
  Prescription.findById(prescriptionId)
    .populate("patient", "name email")
    .populate("doctor", "name email profile.specialization");

const issuePrescription = async ({
  doctorId,
  patientId,
  appointmentId,
  medications,
  diagnosis,
  notes,
  validDays,
  refillsAllowed,
}) => {
  const [doctor, patient] = await Promise.all([
    User.findById(doctorId).select("name email role profile.specialization"),
    User.findById(patientId).select("name email role"),
  ]);

  if (!doctor || doctor.role !== "DOCTOR") {
    throw createError("Invalid doctor", 400);
  }

  if (!patient || patient.role !== "PATIENT") {
    throw createError("Invalid patient", 400);
  }

  if (!diagnosis) {
    throw createError("Diagnosis is required", 400);
  }

  validateMedications(medications);

  let appointment = null;

  if (appointmentId) {
    appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      throw createError("Appointment not found", 404);
    }

    if (appointment.doctor.toString() !== doctorId) {
      throw createError("Not your appointment", 403);
    }

    if (appointment.patient.toString() !== patientId) {
      throw createError("Appointment does not belong to this patient", 400);
    }

    if (!["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(appointment.status)) {
      throw createError("Invalid appointment status for prescription", 400);
    }
  }

  const prescription = await Prescription.create({
    patient: patientId,
    doctor: doctorId,
    appointment: appointmentId,
    medications,
    diagnosis,
    notes,
    validUntil: new Date(
      Date.now() + (validDays || 30) * 24 * 60 * 60 * 1000
    ),
    refillsAllowed: refillsAllowed || 0,
  });

  try {
    await ehrService.addEHREntry({
      patientId,
      doctorId,
      appointmentId,
      type: "PRESCRIPTION",
      title: `Prescription - ${diagnosis}`,
      content: JSON.stringify({
        medications,
        diagnosis,
        notes,
        prescriptionId: prescription._id,
      }),
    });
  } catch (error) {
  }

  if (appointment) {
    appointment.prescription = prescription._id;
    await appointment.save();
  }

  try {
    await notificationService.sendPrescriptionNotification(
      prescription,
      patient,
      doctor
    );
  } catch (error) {
  }

  await createAuditLog({
    actor: doctorId,
    actorRole: "DOCTOR",
    action: "PRESCRIPTION_CREATE",
    targetResource: "Prescription",
    targetId: prescription._id,
    patient: patientId,
    metadata: {
      appointmentId,
      medicationCount: medications.length,
      diagnosis,
    },
  });

  return populatePrescription(prescription._id);
};

const getPatientPrescriptions = async ({
  patientId,
  requesterId,
  requesterRole,
  filters = {},
}) => {
  if (requesterRole === "PATIENT" && requesterId !== patientId) {
    throw createError("Access denied", 403);
  }

  if (requesterRole === "DOCTOR") {
    const hasAppointment = await Appointment.exists({
      doctor: requesterId,
      patient: patientId,
    });

    if (!hasAppointment) {
      throw createError("Access denied", 403);
    }
  }

  if (!["PATIENT", "DOCTOR", "ADMIN"].includes(requesterRole)) {
    throw createError("Access denied", 403);
  }

  const query = { patient: patientId };

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.active) {
    query.status = "ACTIVE";
    query.validUntil = { $gt: new Date() };
  }

  return Prescription.find(query)
    .sort({ issuedAt: -1 })
    .populate("doctor", "name email profile.specialization");
};

const getPrescriptionById = async ({
  prescriptionId,
  requesterId,
  requesterRole,
}) => {
  const prescription = await Prescription.findById(prescriptionId)
    .populate("patient", "name email")
    .populate("doctor", "name email profile.specialization");

  if (!prescription) {
    throw createError("Prescription not found", 404);
  }

  const isPatient = prescription.patient._id.toString() === requesterId;
  const isDoctor = prescription.doctor._id.toString() === requesterId;

  if (!isPatient && !isDoctor && requesterRole !== "ADMIN") {
    throw createError("Access denied", 403);
  }

  return prescription;
};

const updatePrescriptionStatus = async ({ prescriptionId, doctorId, status }) => {
  const prescription = await Prescription.findById(prescriptionId);

  if (!prescription) {
    throw createError("Prescription not found", 404);
  }

  if (prescription.doctor.toString() !== doctorId) {
    throw createError("Access denied", 403);
  }

  if (!["COMPLETED", "CANCELLED"].includes(status)) {
    throw createError("Invalid status", 400);
  }

  if (prescription.status === "CANCELLED") {
    throw createError("Already cancelled", 400);
  }

  prescription.status = status;
  await prescription.save();

  return populatePrescription(prescription._id);
};

const requestRefill = async ({ prescriptionId, patientId }) => {
  const prescription = await Prescription.findById(prescriptionId)
    .populate("patient", "name email")
    .populate("doctor", "name email profile.specialization");

  if (!prescription) {
    throw createError("Prescription not found", 404);
  }

  if (prescription.patient._id.toString() !== patientId) {
    throw createError("Access denied", 403);
  }

  if (prescription.status !== "ACTIVE") {
    throw createError("Prescription is not active", 400);
  }

  if (prescription.isExpired) {
    throw createError("Prescription has expired", 400);
  }

  if (prescription.refillsUsed >= prescription.refillsAllowed) {
    throw createError("No refills remaining", 400);
  }

  prescription.refillsUsed += 1;
  await prescription.save();

  return prescription;
};

module.exports = {
  issuePrescription,
  getPatientPrescriptions,
  getPrescriptionById,
  updatePrescriptionStatus,
  requestRefill,
};
