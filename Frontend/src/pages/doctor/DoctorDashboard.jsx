import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useLang } from "../../App";
import { LANGUAGES } from "../../i18n";
import {
  apiGetMyAppointments, apiUpdateConsultationNotes, apiSetDoctorAvailability,
  apiGetMyNotifications, apiAddEHREntry, apiGetPatientEHR,
  apiIssuePrescription, apiGetPatientPrescriptions, apiUpdatePrescriptionStatus,
} from "../../api";
import NotificationPanel from "../../components/NotificationPanel";
import DoctorAppointmentsPanel from "../../components/DoctorAppointmentsPanel";

function TopBar({ user, t, lang, switchLang }) {
  const initials = user.name.split(" ").map(n=>n[0]).join("").toUpperCase().slice(0,2);
  const [showNotif, setShowNotif] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    apiGetMyNotifications({ limit: 5 })
      .then(d => setUnread(d.total || 0))
      .catch(() => {});
  }, []);

  return (
    <div className="top-bar" style={{ position: "relative" }}>
      <span className="top-bar-brand">{t.appName}</span>
      <div className="top-bar-right">
        <div className="lang-toggle">
          {LANGUAGES.map(l => (
            <button key={l.code} className={`lang-btn ${lang===l.code?"active":""}`} onClick={() => switchLang(l.code)}>
              {l.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowNotif(v => !v)}
          style={{ position: "relative", background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", padding: "0.2rem" }}
        >
          🔔
          {unread > 0 && (
            <span style={{
              position: "absolute", top: 0, right: 0,
              background: "#b91c1c", color: "#fff",
              borderRadius: "999px", fontSize: "0.55rem",
              fontWeight: 700, padding: "0 3px", minWidth: 14, textAlign: "center",
            }}>{unread > 99 ? "99+" : unread}</span>
          )}
        </button>
        <div className="avatar avatar-blue">{initials}</div>
      </div>
      {showNotif && <NotificationPanel onClose={() => setShowNotif(false)} />}
    </div>
  );
}

function HomeTab({ user, t, setTab }) {
  const [appointments, setAppointments] = useState([]);
  const [rxCount, setRxCount] = useState(0);

  useEffect(() => {
    apiGetMyAppointments().then(d => {
      const appts = d.appointments || [];
      setAppointments(appts);
      // Count unique patients who have appointments as a proxy for prescriptions issued
      // Real count loads when doctor visits the Rx tab
    }).catch(() => {});
  }, []);

  const today = new Date().toISOString().split("T")[0];
  const todayCount = appointments.filter(a => new Date(a.date).toISOString().split("T")[0] === today).length;
  const upcoming = appointments.filter(a => a.status === "CONFIRMED");

  return (
    <div className="page-content">
      <div style={{ marginBottom:"1rem" }}>
        <div style={{ fontWeight:800, fontSize:"1.05rem", color:"#1e293b" }}>{t.welcomeBack}, {user.name.split(" ").slice(0,2).join(" ")}</div>
        <div style={{ fontSize:"0.78rem", color:"#64748b" }}>{user.profile?.specialization || user.specialization}</div>
      </div>
      <div className="stat-row">
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue">📅</div>
          <div className="stat-value">{todayCount}</div>
          <div className="stat-label">{t.todaysAppointments}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-purple">💊</div>
          <div className="stat-value">{rxCount}</div>
          <div className="stat-label">{t.prescriptionsIssued}</div>
        </div>
      </div>
      <div className="section-header"><div className="section-title">{t.quickActions}</div></div>
      <div className="quick-grid">
        {[
          { icon:"📅", label:t.viewSchedule,      tab:"appointments"  },
          { icon:"💊", label:t.writePrescription,  tab:"prescriptions" },
          { icon:"👥", label:t.myPatients,         tab:"patients"      },
          { icon:"⏰",  label:"Set Availability",   tab:"availability"  },
        ].map(q => (
          <button key={q.tab+q.label} className="quick-btn" onClick={() => setTab(q.tab)}>
            <span className="quick-btn-icon">{q.icon}</span>
            <span className="quick-btn-label">{q.label}</span>
          </button>
        ))}
      </div>
      <div className="section-header">
        <div className="section-title">{t.upcomingAppointmentsTitle}</div>
        <span className="text-blue text-sm cursor-pointer" onClick={() => setTab("appointments")}>{t.seeAll}</span>
      </div>
      <div className="card">
        {upcoming.length === 0 ? (
          <div className="empty-state" style={{ padding:"1.25rem" }}>
            <div className="empty-state-icon">📅</div>
            <div className="empty-state-text">{t.noUpcomingApptDoctor}</div>
          </div>
        ) : upcoming.slice(0,3).map(a => (
          <div className="list-item" key={a._id}>
            <div className="list-avatar list-avatar-green">{(a.patient?.name||"P")[0]}</div>
            <div className="list-body">
              <div className="list-title">{a.patient?.name}</div>
              <div className="list-sub">{new Date(a.date).toLocaleDateString("en-IN")} · {a.startTime}</div>
            </div>
            <span className="badge badge-green">Confirmed</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AppointmentsTab({ user, t }) {
  const [appts, setAppts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGetMyAppointments();
      setAppts(data.appointments || []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const endCall = async () => {
    if (!notes.trim()) { setActive(null); return; }
    setSaving(true);
    try {
      await apiUpdateConsultationNotes(active._id, notes.trim());
      // Also save to patient EHR
      await apiAddEHREntry(active.patient._id, {
        type: "CONSULTATION",
        title: "Consultation Notes",
        content: notes.trim(),
        appointmentId: active._id,
      });
      await load();
    } catch {}
    finally { setSaving(false); setActive(null); setNotes(""); }
  };

  if (active) return (
    <div className="page-content">
      <div className="page-header"><div className="page-title">{t.inConsultation}</div></div>
      <div style={{ background:"#0f172a", borderRadius:"0.6rem", height:210, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:"0.9rem" }}>
        <div style={{ textAlign:"center", color:"#fff" }}>
          <div style={{ fontWeight:600, fontSize:"0.9rem" }}>{active.patient?.name}</div>
          <div style={{ fontSize:"0.72rem", color:"#94a3b8", marginTop:"0.25rem" }}>Connected · WebRTC</div>
        </div>
      </div>
      <div style={{ display:"flex", gap:"0.5rem", justifyContent:"center", marginBottom:"0.9rem" }}>
        <button className="btn btn-ghost btn-sm">{t.mute}</button>
        <button className="btn btn-ghost btn-sm">{t.camera}</button>
        <button className="btn btn-danger btn-sm" onClick={endCall} disabled={saving}>
          {saving ? "⏳" : t.endAndSave}
        </button>
      </div>
      <div className="card">
        <div style={{ fontWeight:700, fontSize:"0.88rem", marginBottom:"0.5rem" }}>{t.clinicalNotes}</div>
        <textarea className="form-textarea" style={{ minHeight:110 }}
          placeholder={t.clinicalNotesPlaceholder} value={notes} onChange={e => setNotes(e.target.value)} />
        <div className="alert alert-info mt-2" style={{ fontSize:"0.72rem" }}>{t.notesAutoSave}</div>
      </div>
    </div>
  );

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title">{t.schedule}</div>
        <div className="page-desc">{t.allConsultations}</div>
      </div>
      {loading ? <div className="empty-state"><div style={{ fontSize:"1.5rem" }}>⏳</div></div>
      : appts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📅</div>
          <div className="empty-state-text">{t.noAppointmentsYet}</div>
        </div>
      ) : appts.map(a => (
        <div className="card" key={a._id} style={{ marginBottom:"0.5rem" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div style={{ fontWeight:700, color:"#1e293b", fontSize:"0.9rem" }}>{a.patient?.name}</div>
              <div style={{ fontSize:"0.72rem", color:"#64748b", marginTop:"0.2rem" }}>
                {new Date(a.date).toLocaleDateString("en-IN")} · {a.startTime} – {a.endTime}
              </div>
              {a.notes && <div style={{ fontSize:"0.72rem", color:"#94a3b8" }}>Reason: {a.notes}</div>}
            </div>
            <span className={`badge ${a.status==="CONFIRMED"?"badge-green":a.status==="COMPLETED"?"badge-gray":a.status==="IN_PROGRESS"?"badge-blue":"badge-yellow"}`}>
              {a.status}
            </span>
          </div>
          {a.status === "CONFIRMED" && (
            <button className="btn btn-primary btn-sm mt-3 btn-full"
              onClick={() => { setActive(a); setNotes(a.consultationNotes || ""); }}>
              {t.startConsultation}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function PatientsTab({ user, t }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientEHR, setPatientEHR] = useState(null);
  const [ehrLoading, setEhrLoading] = useState(false);
  const [ehrError, setEhrError] = useState("");

  useEffect(() => {
    apiGetMyAppointments().then(d => setAppointments(d.appointments || [])).catch(() => {});
    setLoading(false);
  }, []);

  const seen = new Set();
  const myPatients = appointments.reduce((acc, a) => {
    if (a.patient && !seen.has(a.patient._id)) {
      seen.add(a.patient._id);
      acc.push(a.patient);
    }
    return acc;
  }, []);

  const handleViewEHR = async (p) => {
    if (selectedPatient?._id === p._id) { setSelectedPatient(null); setPatientEHR(null); setEhrError(""); return; }
    setSelectedPatient(p);
    setEhrLoading(true);
    setEhrError("");
    try {
      const data = await apiGetPatientEHR(p._id);
      setPatientEHR(data.ehr);
    } catch (err) {
      setPatientEHR(null);
      setEhrError(err.status === 403 ? "No active appointment with this patient — EHR access requires a confirmed or completed appointment." : (err.message || "Failed to load EHR."));
    } finally {
      setEhrLoading(false);
    }
  };

  const ENTRY_ICON = { CONSULTATION:"🩺", DIAGNOSIS:"🔬", LAB_REPORT:"📋", PRESCRIPTION:"💊", VACCINATION:"💉", GENERAL_NOTE:"📝" };

  const renderContent = (entry) => {
    if (entry.type === "PRESCRIPTION") {
      try {
        const data = JSON.parse(entry.content);
        return (
          <div>
            {data.diagnosis && <div style={{fontWeight:600,marginBottom:"0.2rem"}}>Diagnosis: {data.diagnosis}</div>}
            {Array.isArray(data.medications) && (
              <ul style={{paddingLeft:"1rem",lineHeight:1.8,margin:"0.2rem 0"}}>
                {data.medications.map((m, i) => (
                  <li key={i}>{m.name} {m.dosage} — {m.frequency}, {m.duration}
                    {m.instructions && <span style={{color:"#64748b"}}> ({m.instructions})</span>}
                  </li>
                ))}
              </ul>
            )}
            {data.notes && <div style={{color:"#64748b"}}>Note: {data.notes}</div>}
          </div>
        );
      } catch { /* fall through */ }
    }
    return <span>{entry.content}</span>;
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title">{t.myPatients}</div>
        <div className="page-desc">{t.patientsWhoBooked}</div>
      </div>
      {loading ? <div className="empty-state"><div style={{ fontSize:"1.5rem" }}>⏳</div></div>
      : myPatients.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👥</div>
          <div className="empty-state-text">{t.noPatientsYet}</div>
        </div>
      ) : myPatients.map(p => (
        <div key={p._id}>
          <div className="card" style={{ marginBottom:"0.5rem", cursor:"pointer" }}
            onClick={() => handleViewEHR(p)}>
            <div style={{ display:"flex", alignItems:"center", gap:"0.7rem" }}>
              <div className="list-avatar list-avatar-green">{p.name[0]}</div>
              <div className="list-body">
                <div className="list-title">{p.name}</div>
                <div className="list-sub">{p.email}</div>
              </div>
              <span style={{ color:"#94a3b8", fontSize:"0.8rem" }}>
                {selectedPatient?._id === p._id ? "▲" : "▼"}
              </span>
            </div>
          </div>
          {selectedPatient?._id === p._id && (
            <div style={{ marginBottom:"0.75rem", paddingLeft:"0.5rem" }}>
              {ehrLoading ? (
                <div style={{ fontSize:"0.78rem", color:"#94a3b8", padding:"0.5rem" }}>⏳ Loading EHR…</div>
              ) : ehrError ? (
                <div style={{ fontSize:"0.78rem", color:"#b91c1c", padding:"0.5rem", background:"#fef2f2", borderRadius:"0.4rem" }}>
                  🔒 {ehrError}
                </div>
              ) : !patientEHR || patientEHR.entries.length === 0 ? (
                <div style={{ fontSize:"0.78rem", color:"#94a3b8", padding:"0.5rem" }}>{t.noRecordsYet}</div>
              ) : patientEHR.entries.slice(-5).reverse().map(e => (
                <div key={e._id} style={{ background:"#f8fafc", borderRadius:"0.5rem", padding:"0.6rem", marginBottom:"0.4rem", fontSize:"0.8rem" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"0.4rem", marginBottom:"0.2rem" }}>
                    <span>{ENTRY_ICON[e.type]||"📄"}</span>
                    <span style={{ fontWeight:600 }}>{e.title}</span>
                    <span style={{ fontSize:"0.68rem", color:"#64748b", marginLeft:"auto" }}>{new Date(e.date).toLocaleDateString("en-IN")}</span>
                  </div>
                  <div style={{ color:"#374151", lineHeight:1.5 }}>{renderContent(e)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AvailabilityTab({ user, t }) {
  const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const [schedule, setSchedule] = useState(
    DAYS.map((_, i) => ({ dayOfWeek: i, startTime: "09:00", endTime: "17:00", slotDurationMinutes: 30, isAvailable: false }))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const toggle = (i) => setSchedule(prev => prev.map((d, idx) => idx === i ? { ...d, isAvailable: !d.isAvailable } : d));
  const update = (i, field, val) => setSchedule(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: val } : d));

  const handleSave = async () => {
    setSaving(true); setError(""); setSaved(false);
    try {
      await apiSetDoctorAvailability({
        weeklySchedule: schedule.filter(d => d.isAvailable),
        blockedDates: [],
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message || "Failed to save availability.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title">⏰ Set Availability</div>
        <div className="page-desc">Configure your weekly schedule</div>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {saved && <div className="alert alert-success">Availability saved!</div>}
      {schedule.map((day, i) => (
        <div className="card" key={i} style={{ marginBottom:"0.5rem" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: day.isAvailable ? "0.75rem" : 0 }}>
            <div style={{ fontWeight:700, fontSize:"0.9rem", color:"#1e293b" }}>{DAYS[i]}</div>
            <label style={{ display:"flex", alignItems:"center", gap:"0.4rem", cursor:"pointer", fontSize:"0.8rem", color:"#64748b" }}>
              <input type="checkbox" checked={day.isAvailable} onChange={() => toggle(i)} />
              Available
            </label>
          </div>
          {day.isAvailable && (
            <div className="form-grid-2">
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Start</label>
                <input type="time" className="form-input" value={day.startTime}
                  onChange={e => update(i, "startTime", e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">End</label>
                <input type="time" className="form-input" value={day.endTime}
                  onChange={e => update(i, "endTime", e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Slot (min)</label>
                <select className="form-select" value={day.slotDurationMinutes}
                  onChange={e => update(i, "slotDurationMinutes", Number(e.target.value))}>
                  {[15,20,30,45,60].map(v => <option key={v} value={v}>{v} min</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      ))}
      <button className="btn btn-primary btn-full mt-3" onClick={handleSave} disabled={saving}>
        {saving ? "⏳ Saving…" : "Save Availability"}
      </button>
    </div>
  );
}

function PrescriptionsTab({ user, t }) {
  const [appointments, setAppointments] = useState([]);
  const [patientId, setPatientId] = useState("");
  const [apptId, setApptId] = useState("");
  const [meds, setMeds] = useState([{ name:"", dosage:"", frequency:"", duration:"", instructions:"", quantity:"" }]);
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [validDays, setValidDays] = useState(30);
  const [refillsAllowed, setRefillsAllowed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState("");
  const [issued, setIssued] = useState([]);
  const [loadingIssued, setLoadingIssued] = useState(false);
  const [updatingId, setUpdatingId] = useState("");

  useEffect(() => {
    apiGetMyAppointments().then(d => setAppointments(d.appointments || [])).catch(() => {});
  }, []);

  const seen = new Set();
  const myPatients = appointments.reduce((acc, a) => {
    if (a.patient && !seen.has(a.patient._id)) {
      seen.add(a.patient._id);
      acc.push(a.patient);
    }
    return acc;
  }, []);

  const patientAppts = appointments.filter(a =>
    a.patient?._id === patientId &&
    ["CONFIRMED","IN_PROGRESS","COMPLETED"].includes(a.status)
  );

  const loadIssued = useCallback(async (pid) => {
    if (!pid) return;
    setLoadingIssued(true);
    try {
      const data = await apiGetPatientPrescriptions(pid);
      setIssued(data.prescriptions || []);
    } catch { setIssued([]); }
    finally { setLoadingIssued(false); }
  }, []);

  const handlePatientChange = (pid) => {
    setPatientId(pid); setApptId(""); setError(""); setSaved(null);
    loadIssued(pid);
  };

  const addMed = () => setMeds([...meds, { name:"", dosage:"", frequency:"", duration:"", instructions:"", quantity:"" }]);
  const remMed = i => setMeds(meds.filter((_,idx) => idx !== i));
  const updMed = (i, f, v) => { const u = [...meds]; u[i][f] = v; setMeds(u); };

  const handleIssue = async () => {
    if (!patientId || !diagnosis.trim() || !meds[0].name.trim()) {
      setError("Patient, diagnosis and at least one medication are required."); return;
    }
    setSaving(true); setError("");
    try {
      const data = await apiIssuePrescription({
        patientId,
        appointmentId: apptId || undefined,
        medications: meds.filter(m => m.name.trim()).map(m => ({
          name: m.name.trim(), dosage: m.dosage.trim(),
          frequency: m.frequency.trim(), duration: m.duration.trim(),
          instructions: m.instructions.trim() || undefined,
          quantity: m.quantity ? Number(m.quantity) : undefined,
        })),
        diagnosis: diagnosis.trim(),
        notes: notes.trim() || undefined,
        validDays: Number(validDays),
        refillsAllowed: Number(refillsAllowed),
      });
      setSaved(data.prescription);
      setMeds([{ name:"", dosage:"", frequency:"", duration:"", instructions:"", quantity:"" }]);
      setDiagnosis(""); setNotes(""); setApptId("");
      loadIssued(patientId);
    } catch (err) {
      setError(err.message || "Failed to issue prescription.");
    } finally { setSaving(false); }
  };

  const handleUpdateStatus = async (id, status) => {
    setUpdatingId(id);
    try {
      await apiUpdatePrescriptionStatus(id, status);
      setIssued(prev => prev.map(p => p._id === id ? { ...p, status } : p));
    } catch (err) { setError(err.message || "Failed to update status."); }
    finally { setUpdatingId(""); }
  };

  const STATUS_BADGE = { ACTIVE:"badge-green", COMPLETED:"badge-gray", CANCELLED:"badge-red" };

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title">{t.writePrescriptionTitle}</div>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {saved && (
        <div className="alert alert-success" style={{ marginBottom:"0.75rem" }}>
          ✅ Prescription issued for <strong>{saved.patient?.name}</strong>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft:"0.5rem" }}
            onClick={() => setSaved(null)}>Dismiss</button>
        </div>
      )}

      {myPatients.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">💊</div>
          <div className="empty-state-text">{t.noPatientsYet}</div>
          <div className="empty-state-sub">{t.prescriptionsAfterConsultation}</div>
        </div>
      ) : (
        <div className="card">
          <div className="form-group">
            <label className="form-label">{t.selectPatient} *</label>
            <select className="form-select" value={patientId} onChange={e => handlePatientChange(e.target.value)}>
              <option value="">{t.selectPatient}</option>
              {myPatients.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>

          {patientId && patientAppts.length > 0 && (
            <div className="form-group">
              <label className="form-label">Link to Appointment (optional)</label>
              <select className="form-select" value={apptId} onChange={e => setApptId(e.target.value)}>
                <option value="">None</option>
                {patientAppts.map(a => (
                  <option key={a._id} value={a._id}>
                    {new Date(a.date).toLocaleDateString("en-IN")} {a.startTime} — {a.status}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Diagnosis *</label>
            <input className="form-input" placeholder="e.g. Hypertension Stage 1"
              value={diagnosis} onChange={e => setDiagnosis(e.target.value)} />
          </div>

          <div className="sep" />
          <div style={{ fontWeight:700, fontSize:"0.85rem", marginBottom:"0.6rem" }}>{t.medications}</div>
          {meds.map((m, i) => (
            <div key={i} style={{ background:"#f8fafc", borderRadius:"0.6rem", padding:"0.8rem", marginBottom:"0.5rem" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"0.4rem" }}>
                <span style={{ fontSize:"0.72rem", fontWeight:700, color:"#64748b" }}>{t.medicine} {i+1}</span>
                {meds.length > 1 && <button style={{ background:"none", border:"none", color:"#b91c1c", cursor:"pointer", fontSize:"0.8rem" }} onClick={() => remMed(i)}>✕</button>}
              </div>
              <div className="form-grid-2">
                <div className="form-group" style={{ marginBottom:"0.4rem" }}>
                  <label className="form-label">{t.medicineName} *</label>
                  <input className="form-input" placeholder="Amlodipine" value={m.name} onChange={e => updMed(i,"name",e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom:"0.4rem" }}>
                  <label className="form-label">{t.dosage} *</label>
                  <input className="form-input" placeholder="5mg" value={m.dosage} onChange={e => updMed(i,"dosage",e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom:"0.4rem" }}>
                  <label className="form-label">{t.frequency} *</label>
                  <input className="form-input" placeholder="Once daily" value={m.frequency} onChange={e => updMed(i,"frequency",e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom:"0.4rem" }}>
                  <label className="form-label">{t.duration} *</label>
                  <input className="form-input" placeholder="30 days" value={m.duration} onChange={e => updMed(i,"duration",e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label className="form-label">Instructions</label>
                  <input className="form-input" placeholder="After meals" value={m.instructions} onChange={e => updMed(i,"instructions",e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label className="form-label">Qty (tablets)</label>
                  <input className="form-input" type="number" placeholder="30" value={m.quantity} onChange={e => updMed(i,"quantity",e.target.value)} />
                </div>
              </div>
            </div>
          ))}
          <button className="btn btn-ghost btn-sm mb-3" onClick={addMed}>{t.addMedicine}</button>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Valid (days)</label>
              <input className="form-input" type="number" value={validDays} onChange={e => setValidDays(e.target.value)} min="1" />
            </div>
            <div className="form-group">
              <label className="form-label">Refills allowed</label>
              <input className="form-input" type="number" value={refillsAllowed} onChange={e => setRefillsAllowed(e.target.value)} min="0" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t.additionalNotes}</label>
            <textarea className="form-textarea" placeholder={t.additionalNotesPlaceholder}
              value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <button className="btn btn-success btn-full" onClick={handleIssue}
            disabled={saving || !patientId || !diagnosis.trim() || !meds[0].name.trim()}>
            {saving ? "⏳ Issuing…" : t.issuePrescription}
          </button>
        </div>
      )}

      {/* Issued prescriptions for selected patient */}
      {patientId && (
        <>
          <div className="section-header mt-4"><div className="section-title">{t.issuedPrescriptions}</div></div>
          {loadingIssued ? (
            <div className="empty-state"><div style={{fontSize:"1.5rem"}}>⏳</div></div>
          ) : issued.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">💊</div>
              <div className="empty-state-text">No prescriptions issued yet</div>
            </div>
          ) : issued.map(p => (
            <div className="card" key={p._id} style={{ marginBottom:"0.5rem" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"0.4rem" }}>
                <div>
                  <div style={{ fontWeight:700, color:"#1e293b", fontSize:"0.88rem" }}>{p.diagnosis}</div>
                  <div style={{ fontSize:"0.7rem", color:"#64748b" }}>
                    {new Date(p.issuedAt).toLocaleDateString("en-IN")} · Valid until {new Date(p.validUntil).toLocaleDateString("en-IN")}
                  </div>
                  <div style={{ fontSize:"0.7rem", color:"#64748b" }}>
                    Refills: {p.refillsUsed}/{p.refillsAllowed}
                  </div>
                </div>
                <span className={`badge ${STATUS_BADGE[p.status] || "badge-gray"}`}>{p.status}</span>
              </div>
              <ul style={{ paddingLeft:"1rem", fontSize:"0.78rem", color:"#374151", lineHeight:1.9, marginBottom:"0.5rem" }}>
                {p.medications.map((m, i) => (
                  <li key={i}>{m.name} {m.dosage} — {m.frequency}, {m.duration}</li>
                ))}
              </ul>
              {p.status === "ACTIVE" && (
                <div style={{ display:"flex", gap:"0.4rem" }}>
                  <button className="btn btn-ghost btn-sm"
                    disabled={updatingId === p._id}
                    onClick={() => handleUpdateStatus(p._id, "COMPLETED")}>
                    Mark Completed
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ color:"#b91c1c" }}
                    disabled={updatingId === p._id}
                    onClick={() => handleUpdateStatus(p._id, "CANCELLED")}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function ProfileTab({ user, t }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const initials = user.name.split(" ").map(n=>n[0]).join("").toUpperCase().slice(0,2);
  const fields = [
    { label:t.email,          value:user.email },
    { label:t.specialization, value:user.specialization||"—" },
    { label:t.licenseId,      value:user.licenseId||"—" },
    { label:t.experienceYrs,  value:user.experience?`${user.experience} yrs`:"—" },
    { label:t.availability,   value:user.availability||"—" },
    { label:t.memberSince,    value:user.joinedAt?new Date(user.joinedAt).toLocaleDateString("en-IN"):"—" },
  ];
  return (
    <div className="page-content">
      <div style={{ textAlign:"center", marginBottom:"1.25rem" }}>
        <div className="avatar avatar-blue" style={{ width:64, height:64, fontSize:"1.5rem", margin:"0 auto 0.6rem" }}>{initials}</div>
        <div style={{ fontWeight:800, fontSize:"1rem" }}>{user.name}</div>
        <span className="badge badge-blue mt-1">{user.specialization||t.doctor}</span>
      </div>
      <div className="card">
        {fields.map(f => (
          <div key={f.label} style={{ padding:"0.6rem 0", borderBottom:"1px solid #f1f5f9" }}>
            <div style={{ fontSize:"0.68rem", fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.05em" }}>{f.label}</div>
            <div style={{ fontWeight:600, color:"#1e293b", marginTop:"0.15rem", fontSize:"0.88rem" }}>{f.value}</div>
          </div>
        ))}
      </div>
      <button className="btn btn-danger btn-full mt-4" onClick={() => { logout(); navigate("/"); }}>{t.logout}</button>
    </div>
  );
}

export default function DoctorDashboard() {
  const { user } = useAuth();
  const { t, lang, switchLang } = useLang();
  const [tab, setTab] = useState("home");
  const NAV = [
    { id:"home",          label:t.home     },
    { id:"appointments",  label:t.schedule },
    { id:"patients",      label:t.patients },
    { id:"prescriptions", label:t.rx       },
    { id:"profile",       label:t.profile  },
  ];
  const NAV_ICONS = { home:"🏠", appointments:"📅", patients:"👥", prescriptions:"💊", profile:"👤" };
  const render = () => {
    switch(tab) {
      case "home":          return <HomeTab user={user} t={t} setTab={setTab} />;
      case "appointments":  return <DoctorAppointmentsPanel t={t} />;
      case "patients":      return <PatientsTab user={user} t={t} />;
      case "availability":  return <AvailabilityTab user={user} t={t} />;
      case "prescriptions": return <PrescriptionsTab user={user} t={t} />;
      case "profile":       return <ProfileTab user={user} t={t} />;
      default:              return <HomeTab user={user} t={t} setTab={setTab} />;
    }
  };
  return (
    <>
      <TopBar user={user} t={t} lang={lang} switchLang={switchLang} />
      {render()}
      <nav className="bottom-nav">
        {NAV.map(n => (
          <button key={n.id} className={`bottom-nav-item ${tab===n.id?"nav-active":""}`} onClick={() => setTab(n.id)}>
            <span className="bottom-nav-icon">{NAV_ICONS[n.id]}</span>
            <span className="bottom-nav-label">{n.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
