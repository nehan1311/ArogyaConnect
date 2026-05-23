/**
 * api.js — Centralised HTTP client for ArogyaConnect backend
 *
 * Base URL:  /api  (proxied to http://localhost:5000 by Vite in dev)
 * Auth:      Bearer <accessToken> stored in memory (localStorage for persistence)
 * Refresh:   Automatic silent refresh via /api/auth/refresh (httpOnly cookie)
 */

const BASE = "/api";

// ── Token storage ────────────────────────────────────────────────
// Access token lives in localStorage so it survives page refresh.
// Refresh token is httpOnly cookie — the browser handles it automatically.
const TOKEN_KEY = "ac_access_token";

export const getToken   = ()      => localStorage.getItem(TOKEN_KEY);
export const setToken   = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = ()      => localStorage.removeItem(TOKEN_KEY);

// ── Core fetch wrapper ───────────────────────────────────────────
let isRefreshing = false;
let refreshQueue = []; // callbacks waiting for a new token

async function request(path, options = {}, retry = true) {
  const token = getToken();

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${BASE}${path}`, {
    credentials: "include", // send httpOnly refresh-token cookie
    ...options,
    headers,
  });

  // Silent token refresh on 401
  if (res.status === 401 && retry) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshRes = await fetch(`${BASE}/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          setToken(data.accessToken);
          refreshQueue.forEach((cb) => cb(data.accessToken));
          refreshQueue = [];
        } else {
          // Refresh failed — clear everything and let the caller handle it
          clearToken();
          refreshQueue.forEach((cb) => cb(null));
          refreshQueue = [];
          return res; // return original 401
        }
      } finally {
        isRefreshing = false;
      }
    } else {
      // Queue this request until refresh completes
      await new Promise((resolve) => refreshQueue.push(resolve));
    }
    // Retry original request with new token
    return request(path, options, false);
  }

  return res;
}

// ── Convenience methods ──────────────────────────────────────────
const get  = (path, opts)  => request(path, { method: "GET",    ...opts });
const post = (path, body)  => request(path, { method: "POST",   body: JSON.stringify(body) });
const put  = (path, body)  => request(path, { method: "PUT",    body: JSON.stringify(body) });
const del  = (path)        => request(path, { method: "DELETE" });

// ── Response helper ──────────────────────────────────────────────
// Throws a plain Error with the server's message on non-2xx responses.
export async function handleResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data   = data;
    throw err;
  }
  return data;
}

// ── Auth API ─────────────────────────────────────────────────────

/**
 * Register a new PATIENT or DOCTOR.
 * Backend role values: "PATIENT" | "DOCTOR"
 */
export async function apiRegister({ name, email, password, role, profile }) {
  const res = await post("/auth/register", { name, email, password, role, profile });
  return handleResponse(res);
}

/**
 * Login with email + password.
 * Returns { accessToken, user }
 */
export async function apiLogin({ email, password }) {
  const res = await post("/auth/login", { email, password });
  return handleResponse(res);
}

/**
 * Fetch the currently authenticated user from the server.
 * Requires a valid access token.
 */
export async function apiGetMe() {
  const res = await get("/auth/me");
  return handleResponse(res);
}

/**
 * Silently refresh the access token using the httpOnly refresh cookie.
 */
export async function apiRefresh() {
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  return handleResponse(res);
}

/**
 * Logout — clears local token.
 * (No backend logout endpoint yet; just clear client-side state.)
 */
export function apiLogout() {
  clearToken();
}

/**
 * Forgot password — sends reset email.
 */
export async function apiForgotPassword(email) {
  const res = await post("/auth/forgot-password", { email });
  return handleResponse(res);
}

/**
 * Reset password with token from email link.
 */
export async function apiResetPassword(token, password) {
  const res = await post(`/auth/reset-password/${token}`, { password });
  return handleResponse(res);
}

// ── Health checks ────────────────────────────────────────────────
export async function apiHealthLive() {
  const res = await get("/health/live");
  return handleResponse(res);
}

export async function apiHealthDB() {
  const res = await get("/health/db");
  return handleResponse(res);
}

export { get as apiGet, post as apiPost, put as apiPut, del as apiDelete };

// ── Appointment & Doctor API ────────────────────────────────────

export async function apiSearchDoctors({ specialization, name, date } = {}) {
  const params = new URLSearchParams();
  if (specialization) params.set("specialization", specialization);
  if (name) params.set("name", name);
  if (date) params.set("date", date);
  const res = await get(`/doctors?${params.toString()}`);
  return handleResponse(res);
}

export async function apiGetDoctorSlots(doctorId, date) {
  const res = await get(`/doctors/${doctorId}/availability?date=${date}`);
  return handleResponse(res);
}

export async function apiSetDoctorAvailability(payload) {
  const res = await post("/doctors/availability", payload);
  return handleResponse(res);
}

export async function apiBookAppointment({ doctorId, date, startTime, notes }) {
  const res = await post("/appointments", { doctorId, date, startTime, notes });
  return handleResponse(res);
}

export async function apiGetMyAppointments(status) {
  const url = status ? `/appointments/my?status=${status}` : "/appointments/my";
  const res = await get(url);
  return handleResponse(res);
}

export async function apiCancelAppointment(id, reason) {
  const res = await request(`/appointments/${id}/cancel`, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  });
  return handleResponse(res);
}

export async function apiUpdateConsultationNotes(id, consultationNotes) {
  const res = await request(`/appointments/${id}/notes`, {
    method: "PATCH",
    body: JSON.stringify({ consultationNotes }),
  });
  return handleResponse(res);
}

// ── Notifications API ────────────────────────────────────────────

export async function apiGetMyNotifications({ page = 1, limit = 20, type, status } = {}) {
  const params = new URLSearchParams({ page, limit });
  if (type) params.set("type", type);
  if (status) params.set("status", status);
  const res = await get(`/notifications/my?${params.toString()}`);
  return handleResponse(res);
}

export async function apiGetNotificationStats() {
  const res = await get("/notifications/stats");
  return handleResponse(res);
}

// ── Admin API ─────────────────────────────────────────────────────
// All admin endpoints require ADMIN role JWT — the token is sent
// automatically via the Authorization header in every request().

/** Platform stats: doctor/patient counts, pending approvals */
export async function apiAdminGetStats() {
  const res = await get("/admin/stats");
  return handleResponse(res);
}

/** List all doctors with status */
export async function apiAdminGetDoctors() {
  const res = await get("/admin/doctors");
  return handleResponse(res);
}

/** List all patients */
export async function apiAdminGetPatients() {
  const res = await get("/admin/patients");
  return handleResponse(res);
}

/** Approve a pending doctor */
export async function apiAdminApproveDoctor(id) {
  const res = await request(`/admin/doctors/${id}/approve`, { method: "PATCH" });
  return handleResponse(res);
}

/** Reject a pending doctor */
export async function apiAdminRejectDoctor(id) {
  const res = await request(`/admin/doctors/${id}/reject`, { method: "PATCH" });
  return handleResponse(res);
}

/** Suspend an active doctor */
export async function apiAdminSuspendDoctor(id) {
  const res = await request(`/admin/doctors/${id}/suspend`, { method: "PATCH" });
  return handleResponse(res);
}

/** Reactivate a suspended/rejected doctor */
export async function apiAdminReactivateDoctor(id) {
  const res = await request(`/admin/doctors/${id}/reactivate`, { method: "PATCH" });
  return handleResponse(res);
}

/** Deactivate a patient account */
export async function apiAdminDeactivatePatient(id) {
  const res = await request(`/admin/patients/${id}/deactivate`, { method: "PATCH" });
  return handleResponse(res);
}

/** Reactivate a patient account */
export async function apiAdminActivatePatient(id) {
  const res = await request(`/admin/patients/${id}/activate`, { method: "PATCH" });
  return handleResponse(res);
}
