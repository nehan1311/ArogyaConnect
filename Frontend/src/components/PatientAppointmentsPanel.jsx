import { useState, useEffect, useCallback } from "react";
import { apiGetMyAppointments, apiCancelAppointment } from "../api";
import { PatientVideoCard } from "./VideoConsultation";

export default function PatientAppointmentsPanel({ t }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGetMyAppointments();
      setAppointments(data.appointments || []);
    } catch (err) {
      setError(err.message || "Failed to load appointments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCancel = async (id) => {
    setCancellingId(id);
    setError("");
    try {
      await apiCancelAppointment(id, "Cancelled by patient");
      setAppointments((current) =>
        current.map((appointment) =>
          appointment._id === id
            ? { ...appointment, status: "CANCELLED" }
            : appointment
        )
      );
    } catch (err) {
      setError(err.message || "Cancel failed.");
    } finally {
      setCancellingId(null);
    }
  };

  const statusBadge = (status) => {
    const map = {
      CONFIRMED: "badge-green",
      COMPLETED: "badge-gray",
      CANCELLED: "badge-red",
      IN_PROGRESS: "badge-blue",
      REQUESTED: "badge-yellow",
    };

    return map[status] || "badge-gray";
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title">{t.myAppointments}</div>
        <div className="page-desc">{t.allConsultations}</div>
      </div>
      {error ? <div className="alert alert-danger">{error}</div> : null}
      {loading ? (
        <div className="empty-state">
          <div style={{ fontSize: "1.5rem" }}>...</div>
        </div>
      ) : appointments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">Appointments</div>
          <div className="empty-state-text">{t.noAppointmentsYet}</div>
          <div className="empty-state-sub">{t.bookFirstConsultation}</div>
        </div>
      ) : (
        appointments.map((appointment) => (
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
                <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.2rem" }}>
                  {appointment.doctor?.profile?.specialization}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                  {new Date(appointment.date).toLocaleDateString("en-IN")} · {appointment.startTime} - {appointment.endTime}
                </div>
                {appointment.notes ? (
                  <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "0.2rem" }}>
                    Note: {appointment.notes}
                  </div>
                ) : null}
              </div>
              <span className={`badge ${statusBadge(appointment.status)}`}>
                {appointment.status}
              </span>
            </div>
            <PatientVideoCard appointment={appointment} onRefresh={load} />
            {(appointment.status === "CONFIRMED" ||
              appointment.status === "REQUESTED") ? (
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                <button
                  className="btn btn-ghost btn-sm btn-full"
                  style={{ color: "#b91c1c" }}
                  disabled={cancellingId === appointment._id}
                  onClick={() => handleCancel(appointment._id)}
                >
                  {cancellingId === appointment._id ? "..." : "Cancel"}
                </button>
              </div>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}
