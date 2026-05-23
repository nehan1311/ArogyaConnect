import { apiPost, apiGet, handleResponse } from "../api";

export const createRoom = (appointmentId) =>
  apiPost("/video/room", { appointmentId }).then(handleResponse);

export const joinRoom = (appointmentId) =>
  apiPost("/video/join", { appointmentId }).then(handleResponse);

export const endSession = (appointmentId) =>
  apiPost("/video/end", { appointmentId }).then(handleResponse);

export const getSession = (appointmentId) =>
  apiGet(`/video/session/${appointmentId}`).then(handleResponse);
