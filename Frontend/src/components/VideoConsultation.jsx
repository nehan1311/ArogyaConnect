import { useState, useEffect, useCallback } from "react";
import * as videoService from "../services/videoService";

function Toast({ msg, type, onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3000);
    return () => clearTimeout(timer);
  }, [onDone]);

  const background =
    type === "error" ? "#b91c1c" : type === "success" ? "#15803d" : "#1e40af";

  return (
    <div
      style={{
        position: "fixed",
        bottom: "5rem",
        left: "50%",
        transform: "translateX(-50%)",
        background,
        color: "#fff",
        padding: "0.6rem 1.1rem",
        borderRadius: "0.6rem",
        fontSize: "0.82rem",
        fontWeight: 600,
        zIndex: 9999,
        boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
        maxWidth: "90vw",
        textAlign: "center",
        whiteSpace: "pre-wrap",
      }}
    >
      {msg}
    </div>
  );
}

function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9998,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "0.75rem",
          padding: "1.25rem 1rem",
          width: "min(320px, 90vw)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: "0.95rem",
            color: "#1e293b",
            marginBottom: "0.5rem",
          }}
        >
          End Consultation?
        </div>
        <div
          style={{
            fontSize: "0.82rem",
            color: "#64748b",
            marginBottom: "1rem",
            lineHeight: 1.5,
          }}
        >
          {message}
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            className="btn btn-ghost btn-sm"
            style={{ flex: 1 }}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="btn btn-danger btn-sm"
            style={{ flex: 1 }}
            onClick={onConfirm}
          >
            End Session
          </button>
        </div>
      </div>
    </div>
  );
}

function SessionStatus({ status }) {
  if (!status) {
    return null;
  }

  if (status === "ACTIVE") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.35rem",
          fontSize: "0.72rem",
          fontWeight: 700,
          color: "#15803d",
        }}
      >
        <span className="pulse-dot" />
        Consultation Live
      </span>
    );
  }

  if (status === "CREATED") {
    return (
      <span className="badge badge-blue" style={{ fontSize: "0.68rem" }}>
        Room Ready
      </span>
    );
  }

  if (status === "ENDED") {
    return (
      <span className="badge badge-gray" style={{ fontSize: "0.68rem" }}>
        Session Ended
      </span>
    );
  }

  return null;
}

function openConsultationWindow() {
  return window.open("", "_blank", "noopener,noreferrer");
}

function openVideoRoom(popup, finalUrl) {
  if (popup && !popup.closed) {
    popup.location.href = finalUrl;
    return;
  }

  window.location.assign(finalUrl);
}

function getVideoErrorMessage(error, fallback) {
  if (error?.status === 404) {
    return "The consultation room is not ready yet. Ask the doctor to start it first.";
  }

  if (
    error?.status === 502 ||
    error?.message?.includes("ECONNREFUSED") ||
    error?.message?.includes("Jitsi")
  ) {
    return "The video service is unavailable right now. Please try again shortly.";
  }

  return error?.message || fallback;
}

function useSessionLookup(appointmentId) {
  const [session, setSession] = useState(null);

  const fetchSession = useCallback(async () => {
    try {
      const data = await videoService.getSession(appointmentId);
      setSession(data.session || null);
      return data.session || null;
    } catch {
      setSession(null);
      return null;
    }
  }, [appointmentId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  return { session, setSession, fetchSession };
}

export function DoctorVideoCard({ appointment, onRefresh }) {
  const [loading, setLoading] = useState(false);
  const [ending, setEnding] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState(null);
  const appointmentId = appointment._id;
  const { session, setSession } = useSessionLookup(appointmentId);

  const showToast = (msg, type = "info") => setToast({ msg, type });
  const isActive = session?.status === "ACTIVE";
  const isCreated = session?.status === "CREATED";
  const isEnded = session?.status === "ENDED";
  const canRejoin = isActive || isCreated || appointment.status === "IN_PROGRESS";

  const handleStart = async () => {
    setLoading(true);
    let popup = null;

    try {
      popup = openConsultationWindow();
      const data = await videoService.createRoom(appointmentId);
      const finalUrl = data.roomUrl;

      openVideoRoom(popup, finalUrl);
      setSession((current) => ({
        ...current,
        appointment: appointmentId,
        roomUrl: data.roomUrl,
        status: "CREATED",
      }));
      onRefresh?.();
      showToast(
        popup
          ? "Video room started. Opening in new tab..."
          : "Video room started. Opening consultation...",
        "success"
      );
    } catch (err) {
      if (popup && !popup.closed) {
        popup.close();
      }
      showToast(
        getVideoErrorMessage(err, "Failed to start video room."),
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRejoin = async () => {
    setLoading(true);
    let popup = null;

    try {
      popup = openConsultationWindow();
      const data = await videoService.joinRoom(appointmentId);
      const finalUrl = data.roomUrl;

      openVideoRoom(popup, finalUrl);
      setSession((current) => ({
        ...current,
        roomUrl: data.roomUrl,
        status: data.status || "ACTIVE",
      }));
      onRefresh?.();
      showToast(
        popup
          ? "Rejoining consultation..."
          : "Opening consultation...",
        "success"
      );
    } catch (err) {
      if (popup && !popup.closed) {
        popup.close();
      }
      showToast(getVideoErrorMessage(err, "Failed to rejoin."), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleEnd = async () => {
    setShowConfirm(false);
    setEnding(true);

    try {
      await videoService.endSession(appointmentId);
      setSession((current) => ({ ...current, status: "ENDED" }));
      onRefresh?.();
      showToast("Consultation ended successfully.", "success");
    } catch (err) {
      showToast(getVideoErrorMessage(err, "Failed to end session."), "error");
    } finally {
      setEnding(false);
    }
  };

  if (appointment.status === "COMPLETED" || isEnded) {
    return (
      <div
        style={{
          marginTop: "0.6rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <span className="badge badge-gray">Consultation Completed</span>
        {toast ? (
          <Toast
            msg={toast.msg}
            type={toast.type}
            onDone={() => setToast(null)}
          />
        ) : null}
      </div>
    );
  }

  return (
    <>
      {toast ? (
        <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />
      ) : null}
      {showConfirm ? (
        <ConfirmModal
          message="This will end the session for all participants and mark the appointment as Completed."
          onConfirm={handleEnd}
          onCancel={() => setShowConfirm(false)}
        />
      ) : null}

      <div
        style={{
          marginTop: "0.75rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        {canRejoin ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <SessionStatus status={session?.status || "ACTIVE"} />
          </div>
        ) : null}

        <div style={{ display: "flex", gap: "0.5rem" }}>
          {!canRejoin && appointment.status === "CONFIRMED" ? (
            <button
              className="btn btn-primary btn-sm btn-full"
              onClick={handleStart}
              disabled={loading}
            >
              {loading ? "Starting..." : "Start Consultation"}
            </button>
          ) : null}

          {canRejoin ? (
            <button
              className="btn btn-primary btn-sm btn-full"
              onClick={handleRejoin}
              disabled={loading}
            >
              {loading ? "Joining..." : "Rejoin Consultation"}
            </button>
          ) : null}

          {canRejoin ? (
            <button
              className="btn btn-danger btn-sm"
              style={{ flexShrink: 0 }}
              onClick={() => setShowConfirm(true)}
              disabled={ending}
            >
              {ending ? "..." : "End"}
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}

export function PatientVideoCard({ appointment, onRefresh }) {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const appointmentId = appointment._id;
  const { session, setSession } = useSessionLookup(appointmentId);

  const showToast = (msg, type = "info") => setToast({ msg, type });
  const isActive = session?.status === "ACTIVE";
  const isCreated = session?.status === "CREATED";
  const isEnded = session?.status === "ENDED";
  const canJoin = appointment.status === "IN_PROGRESS" || isActive || isCreated;

  const handleJoin = async () => {
    setLoading(true);
    let popup = null;

    try {
      popup = openConsultationWindow();
      const data = await videoService.joinRoom(appointmentId);
      const finalUrl = data.roomUrl;

      openVideoRoom(popup, finalUrl);
      setSession((current) => ({
        ...current,
        roomUrl: data.roomUrl,
        status: data.status || "ACTIVE",
      }));
      onRefresh?.();
      showToast(
        popup
          ? "Opening video consultation..."
          : "Opening consultation...",
        "success"
      );
    } catch (err) {
      if (popup && !popup.closed) {
        popup.close();
      }
      showToast(
        getVideoErrorMessage(
          err,
          "Failed to join. Doctor may not have started yet."
        ),
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  if (appointment.status === "COMPLETED" || isEnded) {
    return (
      <div style={{ marginTop: "0.6rem" }}>
        <span className="badge badge-gray">Consultation Completed</span>
        {toast ? (
          <Toast
            msg={toast.msg}
            type={toast.type}
            onDone={() => setToast(null)}
          />
        ) : null}
      </div>
    );
  }

  return (
    <>
      {toast ? (
        <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />
      ) : null}

      <div
        style={{
          marginTop: "0.75rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        {isActive || isCreated ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <SessionStatus status={session.status} />
          </div>
        ) : null}

        {canJoin ? (
          <button
            className="btn btn-success btn-sm btn-full"
            onClick={handleJoin}
            disabled={loading}
          >
            {loading
              ? "Joining..."
              : isActive || isCreated
                ? "Rejoin Consultation"
                : "Join Consultation"}
          </button>
        ) : appointment.status === "CONFIRMED" ? (
          <div className="alert alert-info" style={{ marginBottom: 0, fontSize: "0.78rem" }}>
            Waiting for the doctor to start the consultation.
          </div>
        ) : null}
      </div>
    </>
  );
}

export function PatientVideoTab({ t }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const { apiGetMyAppointments } = await import("../api");
      const data = await apiGetMyAppointments();
      const active = (data.appointments || []).filter(
        (appointment) =>
          appointment.status === "CONFIRMED" ||
          appointment.status === "IN_PROGRESS"
      );
      setAppointments(active);
    } catch {
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="page-content">
        <div className="page-header">
          <div className="page-title">{t.videoConsultation}</div>
        </div>
        <div className="empty-state">
          <div style={{ fontSize: "1.5rem" }}>...</div>
        </div>
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="page-content">
        <div className="page-header">
          <div className="page-title">{t.videoConsultation}</div>
        </div>
        <div className="empty-state" style={{ marginTop: "2rem" }}>
          <div className="empty-state-icon">Video</div>
          <div className="empty-state-text">{t.noActiveConsultations}</div>
          <div className="empty-state-sub">{t.bookAppointmentFirst}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title">{t.videoConsultation}</div>
        <div className="page-desc">Your active consultations</div>
      </div>
      {appointments.map((appointment) => (
        <div className="card" key={appointment._id} style={{ marginBottom: "0.5rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "0.9rem" }}>
                {appointment.doctor?.name}
              </div>
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "#64748b",
                  marginTop: "0.2rem",
                }}
              >
                {appointment.doctor?.profile?.specialization} ·{" "}
                {new Date(appointment.date).toLocaleDateString("en-IN")}{" "}
                {appointment.startTime}
              </div>
            </div>
            <span
              className={`badge ${
                appointment.status === "IN_PROGRESS" ? "badge-blue" : "badge-green"
              }`}
            >
              {appointment.status}
            </span>
          </div>
          <PatientVideoCard appointment={appointment} onRefresh={load} />
        </div>
      ))}
    </div>
  );
}
