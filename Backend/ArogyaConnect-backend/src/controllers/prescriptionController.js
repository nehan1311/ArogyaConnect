const prescriptionService = require("../services/prescriptionService");

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const issuePrescription = async (req, res) => {
  const {
    patientId,
    appointmentId,
    medications,
    diagnosis,
    notes,
    validDays,
    refillsAllowed,
  } = req.body;

  if (!patientId || !medications) {
    throw createError("patientId and medications are required", 400);
  }

  const prescription = await prescriptionService.issuePrescription({
    doctorId: req.user.id,
    patientId,
    appointmentId,
    medications,
    diagnosis,
    notes,
    validDays,
    refillsAllowed,
  });

  res.status(201).json({
    success: true,
    prescription,
  });
};

const getMyPrescriptions = async (req, res) => {
  const prescriptions = await prescriptionService.getPatientPrescriptions({
    patientId: req.user.id,
    requesterId: req.user.id,
    requesterRole: "PATIENT",
    filters: {
      status: req.query.status,
      active: req.query.active === "true",
    },
  });

  res.status(200).json({
    success: true,
    count: prescriptions.length,
    prescriptions,
  });
};

const getPatientPrescriptions = async (req, res) => {
  const prescriptions = await prescriptionService.getPatientPrescriptions({
    patientId: req.params.patientId,
    requesterId: req.user.id,
    requesterRole: req.user.role,
    filters: {
      status: req.query.status,
      active: req.query.active === "true",
    },
  });

  res.status(200).json({
    success: true,
    count: prescriptions.length,
    prescriptions,
  });
};

const getPrescriptionById = async (req, res) => {
  const prescription = await prescriptionService.getPrescriptionById({
    prescriptionId: req.params.id,
    requesterId: req.user.id,
    requesterRole: req.user.role,
  });

  res.status(200).json({
    success: true,
    prescription,
  });
};

const updateStatus = async (req, res) => {
  const prescription = await prescriptionService.updatePrescriptionStatus({
    prescriptionId: req.params.id,
    doctorId: req.user.id,
    status: req.body.status,
  });

  res.status(200).json({
    success: true,
    prescription,
  });
};

const requestRefill = async (req, res) => {
  const prescription = await prescriptionService.requestRefill({
    prescriptionId: req.params.id,
    patientId: req.user.id,
  });

  res.status(200).json({
    success: true,
    prescription,
    refillsRemaining: prescription.refillsAllowed - prescription.refillsUsed,
  });
};

module.exports = {
  issuePrescription,
  getMyPrescriptions,
  getPatientPrescriptions,
  getPrescriptionById,
  updateStatus,
  requestRefill,
};
