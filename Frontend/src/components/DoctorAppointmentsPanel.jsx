import { useState, useEffect, useCallback } from "react";
import {
  apiGetMyAppointments,
  apiUpdateConsultationNotes,
  apiAddEHREntry,
} from "../api";
import { DoctorVideoCard } from "./VideoConsultation";

export default function DoctorAppointmentsPanel({ t }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGetMyAppointments();
      setAppointments(data.appointments || []);
    } catch {
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveNotes = async () => {
    if (!active) {
      return;
    }

    if (!notes.trim()) {
      setActive(null);
      return;
    }

    setSaving(true);
    try {
      await apiUpdateConsultationNotes(active._id, notes.trim());
      await apiAddEHREntry(active.patient._id, {
        type: "CONSULTATION",
        title: "Consultation Notes",
        content: notes.trim(),
        appointmentId: active._id,
      });
      await load();
    } catch {
    } finally {
      setSaving(false);
      setActive(null);
      setNotes("");
    }
  };

  if (active) {
    return (
      <div className="page-content">
        <div className="page-header">
          <div className="page-title">{t.clinicalNotes}</div>
          <div className="page-desc">
            {active.patient?.name} · {new Date(active.date).toLocaleDateString("en-IN")} · {active.startTime}
          </div>
        </div>
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: "0.5rem" }}>
            {t.clinicalNotes}
          </div>
          <textarea
            className="form-textarea"
            style={{ minHeight: 140 }}
            placeholder={t.clinicalNotesPlaceholder}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          <div className="alert alert-info mt-2" style={{ fontSize: "0.72rem" }}>
            {t.notesAutoSave}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
            <button
              className="btn btn-primary btn-sm btn-full"
              onClick={saveNotes}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Notes"}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setActive(null)}
              disabled={saving}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title">{t.schedule}</div>
        <div className="page-desc">{t.allConsultations}</div>
      </div>
      {loading ? (
        <div className="empty-state">
          <div style={{ fontSize: "1.5rem" }}>...</div>
        </div>
      ) : appointments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">Appointments</div>
          <div className="empty-state-text">{t.noAppointmentsYet}</div>
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
                  {appointment.patient?.name}
                </div>
                <div
                  style={{
                    fontSize: "0.72rem",
                    color: "#64748b",
                    marginTop: "0.2rem",
                  }}
                >
                  {new Date(appointment.date).toLocaleDateString("en-IN")} · {appointment.startTime} - {appointment.endTime}
                </div>
                {appointment.notes ? (
                  <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                    Reason: {appointment.notes}
                  </div>
                ) : null}
              </div>
              <span
                className={`badge ${
                  appointment.status === "CONFIRMED"
                    ? "badge-green"
                    : appointment.status === "COMPLETED"
                      ? "badge-gray"
                      : appointment.status === "IN_PROGRESS"
                        ? "badge-blue"
                        : "badge-yellow"
                }`}
              >
                {appointment.status}
              </span>
            </div>
            <DoctorVideoCard appointment={appointment} onRefresh={load} />
            {(appointment.status === "IN_PROGRESS" ||
              appointment.status === "COMPLETED" ||
              appointment.consultationNotes) ? (
              <button
                className="btn btn-ghost btn-sm mt-3 btn-full"
                onClick={() => {
                  setActive(appointment);
                  setNotes(appointment.consultationNotes || "");
                }}
              >
                {appointment.consultationNotes
                  ? "Edit Clinical Notes"
                  : "Add Clinical Notes"}
              </button>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}
