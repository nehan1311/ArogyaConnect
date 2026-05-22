/**
 * store.js — localStorage-based state management
 * Simulates a backend until real API integration.
 * All data persists across page refreshes.
 */

const KEYS = {
  USERS: "ac_users",
  CURRENT_USER: "ac_current_user",
  APPOINTMENTS: "ac_appointments",
  EHR: "ac_ehr",
  PRESCRIPTIONS: "ac_prescriptions",
  TRIAGE: "ac_triage",
};

// ── Helpers ──────────────────────────────────────────────────────
const load = (key) => {
  try { return JSON.parse(localStorage.getItem(key)) || null; }
  catch { return null; }
};
const save = (key, val) => localStorage.setItem(key, JSON.stringify(val));

// ── Users ────────────────────────────────────────────────────────
export const getUsers = () => load(KEYS.USERS) || [];

export const saveUser = (user) => {
  const users = getUsers();
  users.push(user);
  save(KEYS.USERS, users);
};

export const findUserByEmail = (email) =>
  getUsers().find((u) => u.email.toLowerCase() === email.toLowerCase());

export const updateUser = (id, updates) => {
  const users = getUsers().map((u) => (u.id === id ? { ...u, ...updates } : u));
  save(KEYS.USERS, users);
};

export const getAllDoctors = () =>
  getUsers().filter((u) => u.role === "doctor");

export const getVerifiedDoctors = () =>
  getUsers().filter((u) => u.role === "doctor" && u.status === "active");

// ── Session ──────────────────────────────────────────────────────
export const getCurrentUser = () => load(KEYS.CURRENT_USER);

export const setCurrentUser = (user) => save(KEYS.CURRENT_USER, user);

export const logout = () => localStorage.removeItem(KEYS.CURRENT_USER);

// ── Appointments ─────────────────────────────────────────────────
export const getAppointments = () => load(KEYS.APPOINTMENTS) || [];

export const saveAppointment = (appt) => {
  const list = getAppointments();
  list.push(appt);
  save(KEYS.APPOINTMENTS, list);
};

export const updateAppointment = (id, updates) => {
  const list = getAppointments().map((a) => (a.id === id ? { ...a, ...updates } : a));
  save(KEYS.APPOINTMENTS, list);
};

export const getAppointmentsForPatient = (patientId) =>
  getAppointments().filter((a) => a.patientId === patientId);

export const getAppointmentsForDoctor = (doctorId) =>
  getAppointments().filter((a) => a.doctorId === doctorId);

// ── EHR ──────────────────────────────────────────────────────────
export const getEHR = () => load(KEYS.EHR) || [];

export const saveEHREntry = (entry) => {
  const list = getEHR();
  list.push(entry);
  save(KEYS.EHR, list);
};

export const getEHRForPatient = (patientId) =>
  getEHR().filter((e) => e.patientId === patientId);

// ── Prescriptions ────────────────────────────────────────────────
export const getPrescriptions = () => load(KEYS.PRESCRIPTIONS) || [];

export const savePrescription = (rx) => {
  const list = getPrescriptions();
  list.push(rx);
  save(KEYS.PRESCRIPTIONS, list);
};

export const getPrescriptionsForPatient = (patientId) =>
  getPrescriptions().filter((p) => p.patientId === patientId);

export const getPrescriptionsForDoctor = (doctorId) =>
  getPrescriptions().filter((p) => p.doctorId === doctorId);

// ── Triage ───────────────────────────────────────────────────────
export const getTriageReports = () => load(KEYS.TRIAGE) || [];

export const saveTriageReport = (report) => {
  const list = getTriageReports();
  list.push(report);
  save(KEYS.TRIAGE, list);
};

export const getTriageForPatient = (patientId) =>
  getTriageReports().filter((r) => r.patientId === patientId);

// ── ID generator ─────────────────────────────────────────────────
export const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ── Medical Reports ──────────────────────────────────────────────
const REPORTS_KEY = "ac_reports";

export const getReports = () => {
  try { return JSON.parse(localStorage.getItem(REPORTS_KEY)) || []; }
  catch { return []; }
};

export const saveReport = (report) => {
  const list = getReports();
  list.push(report);
  localStorage.setItem(REPORTS_KEY, JSON.stringify(list));
};

export const getReportsForPatient = (patientId) =>
  getReports().filter((r) => r.patientId === patientId);
