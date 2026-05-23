const User = require("../models/User");

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// ── GET /api/admin/stats ─────────────────────────────────────────
// Returns platform-level counts for the admin home dashboard.
const getStats = async (req, res) => {
  const [totalDoctors, totalPatients, pendingDoctors] = await Promise.all([
    User.countDocuments({ role: "DOCTOR" }),
    User.countDocuments({ role: "PATIENT" }),
    User.countDocuments({ role: "DOCTOR", isApproved: false, isActive: true }),
  ]);

  res.status(200).json({
    success: true,
    stats: {
      totalDoctors,
      totalPatients,
      pendingDoctors,
      // Appointments / triage counts will come from their own modules later
      totalAppointments: 0,
      criticalAlerts: 0,
    },
  });
};

// ── GET /api/admin/doctors ───────────────────────────────────────
// Returns all doctors with their approval / active status.
const getDoctors = async (req, res) => {
  const doctors = await User.find({ role: "DOCTOR" })
    .select("name email isApproved isActive profile createdAt")
    .sort({ createdAt: -1 })
    .lean();

  // Normalise to a shape the frontend already understands
  const formatted = doctors.map((d) => ({
    id:             d._id.toString(),
    name:           d.name,
    email:          d.email,
    specialization: d.profile?.specialization || "—",
    licenseId:      d.profile?.licenseNumber   || "—",
    // Map backend booleans → frontend status string
    status: !d.isActive
      ? "suspended"
      : d.isApproved
      ? "active"
      : "pending",
    joinedAt: d.createdAt,
  }));

  res.status(200).json({ success: true, doctors: formatted });
};

// ── GET /api/admin/patients ──────────────────────────────────────
// Returns all patients.
const getPatients = async (req, res) => {
  const patients = await User.find({ role: "PATIENT" })
    .select("name email isActive profile createdAt")
    .sort({ createdAt: -1 })
    .lean();

  const formatted = patients.map((p) => ({
    id:       p._id.toString(),
    name:     p.name,
    email:    p.email,
    contact:  p.profile?.phone   || "—",
    location: p.profile?.address || "—",
    status:   p.isActive ? "active" : "inactive",
    joinedAt: p.createdAt,
  }));

  res.status(200).json({ success: true, patients: formatted });
};

// ── PATCH /api/admin/doctors/:id/approve ────────────────────────
// Approve a pending doctor (sets isApproved = true).
const approveDoctor = async (req, res) => {
  const doctor = await User.findOne({ _id: req.params.id, role: "DOCTOR" });
  if (!doctor) throw createError("Doctor not found", 404);

  doctor.isApproved = true;
  doctor.isActive   = true;
  await doctor.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: "Doctor approved successfully",
    doctor: {
      id:     doctor._id.toString(),
      name:   doctor.name,
      email:  doctor.email,
      status: "active",
    },
  });
};

// ── PATCH /api/admin/doctors/:id/reject ─────────────────────────
// Reject a pending doctor (keeps isApproved = false, deactivates).
const rejectDoctor = async (req, res) => {
  const doctor = await User.findOne({ _id: req.params.id, role: "DOCTOR" });
  if (!doctor) throw createError("Doctor not found", 404);

  doctor.isApproved = false;
  doctor.isActive   = false;
  await doctor.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: "Doctor rejected",
    doctor: {
      id:     doctor._id.toString(),
      name:   doctor.name,
      email:  doctor.email,
      status: "rejected",
    },
  });
};

// ── PATCH /api/admin/doctors/:id/suspend ────────────────────────
// Suspend an active doctor (isActive = false).
const suspendDoctor = async (req, res) => {
  const doctor = await User.findOne({ _id: req.params.id, role: "DOCTOR" });
  if (!doctor) throw createError("Doctor not found", 404);

  doctor.isActive = false;
  await doctor.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: "Doctor suspended",
    doctor: {
      id:     doctor._id.toString(),
      name:   doctor.name,
      email:  doctor.email,
      status: "suspended",
    },
  });
};

// ── PATCH /api/admin/doctors/:id/reactivate ─────────────────────
// Reactivate a suspended or rejected doctor.
const reactivateDoctor = async (req, res) => {
  const doctor = await User.findOne({ _id: req.params.id, role: "DOCTOR" });
  if (!doctor) throw createError("Doctor not found", 404);

  doctor.isApproved = true;
  doctor.isActive   = true;
  await doctor.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: "Doctor reactivated",
    doctor: {
      id:     doctor._id.toString(),
      name:   doctor.name,
      email:  doctor.email,
      status: "active",
    },
  });
};

// ── PATCH /api/admin/patients/:id/deactivate ────────────────────
const deactivatePatient = async (req, res) => {
  const patient = await User.findOne({ _id: req.params.id, role: "PATIENT" });
  if (!patient) throw createError("Patient not found", 404);

  patient.isActive = false;
  await patient.save({ validateBeforeSave: false });

  res.status(200).json({ success: true, message: "Patient deactivated" });
};

// ── PATCH /api/admin/patients/:id/activate ──────────────────────
const activatePatient = async (req, res) => {
  const patient = await User.findOne({ _id: req.params.id, role: "PATIENT" });
  if (!patient) throw createError("Patient not found", 404);

  patient.isActive = true;
  await patient.save({ validateBeforeSave: false });

  res.status(200).json({ success: true, message: "Patient activated" });
};

module.exports = {
  getStats,
  getDoctors,
  getPatients,
  approveDoctor,
  rejectDoctor,
  suspendDoctor,
  reactivateDoctor,
  deactivatePatient,
  activatePatient,
};
