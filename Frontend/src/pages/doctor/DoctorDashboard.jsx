import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useLang } from "../../App";
import { LANGUAGES } from "../../i18n";
import {
  apiGetMyAppointments, apiUpdateConsultationNotes, apiSetDoctorAvailability,
  apiGetMyNotifications,
} from "../../api";
import {
  savePrescription, getPrescriptionsForDoctor, genId,
} from "../../store";
import NotificationPanel from "../../components/NotificationPanel";

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
  const rxCount = getPrescriptionsForDoctor(user.id).length;

  useEffect(() => {
    apiGetMyAppointments().then(d => setAppointments(d.appointments || [])).catch(() => {});
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
        <div className="card" key={p._id} style={{ marginBottom:"0.5rem" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"0.7rem" }}>
            <div className="list-avatar list-avatar-green">{p.name[0]}</div>
            <div className="list-body">
              <div className="list-title">{p.name}</div>
              <div className="list-sub">{p.email}</div>
            </div>
          </div>
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
  const [meds, setMeds] = useState([{ name:"", dosage:"", frequency:"", duration:"" }]);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

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

  const addMed = () => setMeds([...meds, { name:"", dosage:"", frequency:"", duration:"" }]);
  const updMed = (i,f,v) => { const u=[...meds]; u[i][f]=v; setMeds(u); };
  const remMed = i => setMeds(meds.filter((_,idx)=>idx!==i));
  const handleSave = () => {
    if (!patientId || !meds[0].name.trim()) return;
    const p = myPatients.find(p => p._id === patientId);
    savePrescription({ id:genId(), patientId, patientName:p?.name||"", doctorId:user.id, doctorName:user.name, medications:meds.filter(m=>m.name.trim()), notes:notes.trim(), date:new Date().toLocaleDateString("en-IN") });
    setSaved(true);
  };
  const myRx = getPrescriptionsForDoctor(user.id);

  if (saved) return (
    <div className="page-content">
      <div className="success-screen">
        <div className="success-icon">✓</div>
        <div className="success-title">{t.prescriptionIssued}</div>
        <div className="success-sub">{t.prescriptionSaved}</div>
        <button className="btn btn-primary btn-full mt-4"
          onClick={() => { setSaved(false); setMeds([{name:"",dosage:"",frequency:"",duration:""}]); setNotes(""); setPatientId(""); }}>
          {t.writeAnother}
        </button>
      </div>
    </div>
  );
  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title">{t.writePrescriptionTitle}</div>
      </div>
      {myPatients.length===0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">💊</div>
          <div className="empty-state-text">{t.noPatientsYet}</div>
          <div className="empty-state-sub">{t.prescriptionsAfterConsultation}</div>
        </div>
      ) : (
        <div className="card">
          <div className="form-group">
            <label className="form-label">{t.selectPatient} *</label>
            <select className="form-select" value={patientId} onChange={e => setPatientId(e.target.value)}>
              <option value="">{t.selectPatient}</option>
              {myPatients.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div className="sep" />
          <div style={{ fontWeight:700, fontSize:"0.85rem", marginBottom:"0.6rem" }}>{t.medications}</div>
          {meds.map((m,i) => (
            <div key={i} style={{ background:"#f8fafc", borderRadius:"0.6rem", padding:"0.8rem", marginBottom:"0.5rem" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"0.4rem" }}>
                <span style={{ fontSize:"0.72rem", fontWeight:700, color:"#64748b" }}>{t.medicine} {i+1}</span>
                {meds.length>1 && <button style={{ background:"none", border:"none", color:"#b91c1c", cursor:"pointer", fontSize:"0.8rem" }} onClick={() => remMed(i)}>✕</button>}
              </div>
              <div className="form-grid-2">
                <div className="form-group" style={{ marginBottom:"0.4rem" }}>
                  <label className="form-label">{t.medicineName}</label>
                  <input className="form-input" placeholder="Paracetamol" value={m.name} onChange={e => updMed(i,"name",e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom:"0.4rem" }}>
                  <label className="form-label">{t.dosage}</label>
                  <input className="form-input" placeholder="500mg" value={m.dosage} onChange={e => updMed(i,"dosage",e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label className="form-label">{t.frequency}</label>
                  <input className="form-input" placeholder="Twice daily" value={m.frequency} onChange={e => updMed(i,"frequency",e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label className="form-label">{t.duration}</label>
                  <input className="form-input" placeholder="5 days" value={m.duration} onChange={e => updMed(i,"duration",e.target.value)} />
                </div>
              </div>
            </div>
          ))}
          <button className="btn btn-ghost btn-sm mb-3" onClick={addMed}>{t.addMedicine}</button>
          <div className="form-group">
            <label className="form-label">{t.additionalNotes}</label>
            <textarea className="form-textarea" placeholder={t.additionalNotesPlaceholder} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <button className="btn btn-success btn-full" onClick={handleSave} disabled={!patientId||!meds[0].name.trim()}>
            {t.issuePrescription}
          </button>
        </div>
      )}
      {myRx.length>0 && (
        <>
          <div className="section-header mt-4"><div className="section-title">{t.issuedPrescriptions}</div></div>
          {[...myRx].reverse().map(p => (
            <div className="card" key={p.id} style={{ marginBottom:"0.5rem" }}>
              <div style={{ fontWeight:700, color:"#1e293b", fontSize:"0.88rem" }}>{p.patientName}</div>
              <div style={{ fontSize:"0.72rem", color:"#64748b", marginBottom:"0.4rem" }}>{p.date}</div>
              <ul style={{ paddingLeft:"1rem", fontSize:"0.8rem", color:"#374151", lineHeight:1.9 }}>
                {p.medications.map((m,i) => <li key={i}>{m.name} {m.dosage} — {m.frequency}</li>)}
              </ul>
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
      case "appointments":  return <AppointmentsTab user={user} t={t} />;
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
