import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useLang } from "../../App";
import { LANGUAGES } from "../../i18n";
import {
  getVerifiedDoctors, getAppointmentsForPatient, saveAppointment,
  getEHRForPatient, getPrescriptionsForPatient, getTriageForPatient,
  saveTriageReport, getReportsForPatient, saveReport, genId,
} from "../../store";

const URGENCY = {
  Low:      { cls:"low",      color:"#15803d", advice: k => k.adviceLow      },
  Medium:   { cls:"medium",   color:"#92400e", advice: k => k.adviceMedium   },
  High:     { cls:"high",     color:"#9a3412", advice: k => k.adviceHigh     },
  Critical: { cls:"critical", color:"#b91c1c", advice: k => k.adviceCritical },
};

function classify(text) {
  const t = text.toLowerCase();
  if (t.includes("chest") || t.includes("unconscious") || t.includes("stroke") || t.includes("breath")) return "Critical";
  if ((t.includes("fever") && t.includes("vomit")) || t.includes("severe")) return "High";
  if (t.includes("fever") || t.includes("pain") || t.includes("headache") || t.includes("cough")) return "Medium";
  return "Low";
}

function TopBar({ user, t, lang, switchLang }) {
  const initials = user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0,2);
  return (
    <div className="top-bar">
      <span className="top-bar-brand">{t.appName}</span>
      <div className="top-bar-right">
        <div className="lang-toggle">
          {LANGUAGES.map(l => (
            <button key={l.code} className={`lang-btn ${lang === l.code ? "active" : ""}`} onClick={() => switchLang(l.code)}>
              {l.label}
            </button>
          ))}
        </div>
        <div className="avatar avatar-green">{initials}</div>
      </div>
    </div>
  );
}

function HomeTab({ user, t, setTab }) {
  const appts = getAppointmentsForPatient(user.id);
  const upcoming = appts.filter(a => a.status !== "Completed");
  const triage = getTriageForPatient(user.id);
  const firstName = user.name.split(" ")[0];
  return (
    <div className="page-content">
      <div style={{ marginBottom:"1rem" }}>
        <div style={{ fontWeight:800, fontSize:"1.05rem", color:"#1e293b" }}>
          {t.welcomeBack}, {firstName}
        </div>
        <div style={{ fontSize:"0.78rem", color:"#64748b" }}>{t.howAreYou}</div>
      </div>
      <div className="stat-row">
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue">📅</div>
          <div className="stat-value">{upcoming.length}</div>
          <div className="stat-label">{t.upcomingAppointments}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-purple">📊</div>
          <div className="stat-value">{triage.length}</div>
          <div className="stat-label">{t.triageReports}</div>
        </div>
      </div>
      <div className="section-header"><div className="section-title">{t.quickActions}</div></div>
      <div className="quick-grid">
        {[
          { icon:"🔬", label:t.checkSymptoms,    tab:"triage" },
          { icon:"📅", label:t.bookAppointment,  tab:"book"   },
          { icon:"📁", label:t.healthRecords,    tab:"records"},
          { icon:"🎥", label:t.joinConsultation, tab:"video"  },
        ].map(q => (
          <button key={q.tab} className="quick-btn" onClick={() => setTab(q.tab)}>
            <span className="quick-btn-icon">{q.icon}</span>
            <span className="quick-btn-label">{q.label}</span>
          </button>
        ))}
      </div>
      <div className="section-header">
        <div className="section-title">{t.upcoming}</div>
        <span className="text-blue text-sm cursor-pointer" onClick={() => setTab("appointments")}>{t.seeAll}</span>
      </div>
      <div className="card">
        {upcoming.length === 0 ? (
          <div className="empty-state" style={{ padding:"1.25rem" }}>
            <div className="empty-state-icon">📅</div>
            <div className="empty-state-text">{t.noUpcomingAppts}</div>
            <div className="empty-state-sub">{t.tapBookToSchedule}</div>
          </div>
        ) : upcoming.slice(0,3).map(a => (
          <div className="list-item" key={a.id}>
            <div className="list-avatar">{(a.doctorName||"D")[0]}</div>
            <div className="list-body">
              <div className="list-title">{a.doctorName}</div>
              <div className="list-sub">{a.specialization} · {a.date} {a.time}</div>
            </div>
            <span className="badge badge-green">{a.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TriageTab({ user, t, lang }) {
  const [symptoms, setSymptoms] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const history = getTriageForPatient(user.id);

  const analyze = async () => {
    if (!symptoms.trim()) return;
    
    setLoading(true); 
    setResult(null);
    
    try {
      // 1. Send the symptoms to YOUR local Python ML server!
      const response = await fetch("http://127.0.0.1:8000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symptoms: symptoms })
      });

      if (!response.ok) throw new Error("Failed to fetch prediction");
      
      const data = await response.json();
      
      // 2. Handle the "unknown" or "insufficient_data" edge cases we built earlier
      if (data.risk_level === "unknown" || data.risk_level === "insufficient_data") {
        alert(data.message); // Show the user the error message
        setLoading(false);
        return;
      }

      // 3. Convert FastAPI's lowercase output ("high") to the UI's capitalized format ("High")
      const urgencyMap = { "low": "Low", "medium": "Medium", "high": "High", "critical": "Critical" };
      const urgency = urgencyMap[data.risk_level] || "Low";

      // 4. Save to history and update UI
      saveTriageReport({ id:genId(), patientId:user.id, symptoms, urgency, date:new Date().toLocaleString("en-IN") });
      setResult(urgency);
      
    } catch (error) {
      console.error("AI Server Error:", error);
      alert("Could not connect to the AI model. Ensure your FastAPI server is running.");
    } finally {
      setLoading(false);
    }
  };
  const cfg = result ? URGENCY[result] : null;
  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title">{t.aiSymptomChecker}</div>
        <div className="page-desc">{t.describeSymptoms}</div>
      </div>
      <div className="alert alert-warning">{t.aiDisclaimer}</div>
      <div className="card">
        <div className="form-group">
          <label className="form-label">{t.symptomsLabel} *</label>
          <textarea className="form-textarea" style={{ minHeight:100 }}
            placeholder={lang === "hi" ? t.symptomsPlaceholderHi : t.symptomsPlaceholderEn}
            value={symptoms} onChange={e => setSymptoms(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-full" onClick={analyze} disabled={loading || !symptoms.trim()}>
          {loading ? t.analyzing : t.analyzeSymptoms}
        </button>
        {cfg && (
          <div className={`triage-result ${cfg.cls}`}>
            <div style={{ fontWeight:800, color:cfg.color, marginBottom:"0.4rem" }}>
              {t.urgency}: {result}
            </div>
            <div style={{ fontSize:"0.82rem", color:"#374151", lineHeight:1.6 }}>
              <strong>{t.recommended}:</strong> {cfg.advice(t)}
            </div>
            {result === "Critical" && <div className="alert alert-danger mt-3">{t.criticalAlert}</div>}
          </div>
        )}
      </div>
      {history.length > 0 && (
        <>
          <div className="section-header mt-4"><div className="section-title">{t.pastReports}</div></div>
          {[...history].reverse().map(r => (
            <div className="card" key={r.id} style={{ marginBottom:"0.5rem" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:"0.85rem", color:"#1e293b" }}>
                    {r.symptoms.slice(0,55)}{r.symptoms.length>55?"…":""}
                  </div>
                  <div style={{ fontSize:"0.72rem", color:"#64748b", marginTop:"0.15rem" }}>{r.date}</div>
                </div>
                <span className={`badge ${r.urgency==="Low"?"badge-green":r.urgency==="Medium"?"badge-yellow":r.urgency==="High"?"badge-orange":"badge-red"}`}>
                  {r.urgency}
                </span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function BookTab({ user, t }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [slot, setSlot] = useState("");
  const [date, setDate] = useState("");
  const [booked, setBooked] = useState(false);
  const doctors = getVerifiedDoctors();
  const filtered = doctors.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.specialization||"").toLowerCase().includes(search.toLowerCase())
  );
  const SLOTS = ["9:00 AM","10:00 AM","11:00 AM","2:00 PM","3:00 PM","4:00 PM"];
  const handleBook = () => {
    if (!slot || !date) return;
    saveAppointment({ id:genId(), patientId:user.id, patientName:user.name, doctorId:selected.id, doctorName:selected.name, specialization:selected.specialization, date, time:slot, status:"Confirmed", bookedAt:new Date().toISOString() });
    setBooked(true);
  };
  if (booked) return (
    <div className="page-content">
      <div className="success-screen">
        <div className="success-icon">✓</div>
        <div className="success-title">{t.appointmentConfirmed}</div>
        <div className="success-sub">
          {selected?.name}<br/>{date} · {slot}<br/>{t.appointmentConfirmedDesc}
        </div>
        <button className="btn btn-primary btn-full mt-4"
          onClick={() => { setBooked(false); setSelected(null); setSlot(""); setDate(""); }}>
          {t.bookAnother}
        </button>
      </div>
    </div>
  );
  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title">{t.bookAppointmentTitle}</div>
        <div className="page-desc">{t.findSpecialist}</div>
      </div>
      <div className="form-group">
        <input className="form-input" placeholder={t.searchDoctorPlaceholder}
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      {doctors.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">👨‍⚕️</div>
          <div className="empty-state-text">{t.noVerifiedDoctors}</div>
          <div className="empty-state-sub">{t.doctorsAppearedOnceApproved}</div>
        </div>
      )}
      {filtered.map(doc => (
        <div key={doc.id} className={`doctor-card ${selected?.id===doc.id?"selected":""}`}
          onClick={() => { setSelected(doc); setSlot(""); }}>
          <div style={{ display:"flex", alignItems:"center", gap:"0.7rem" }}>
            <div className="list-avatar">{(doc.name.split(" ").pop()||"D")[0]}</div>
            <div className="list-body">
              <div className="list-title">{doc.name}</div>
              <div className="list-sub">{doc.specialization}{doc.experience?` · ${doc.experience} ${t.yrsExp}`:""}</div>
            </div>
          </div>
          {selected?.id===doc.id && (
            <div style={{ marginTop:"0.85rem" }}>
              <div className="form-group">
                <label className="form-label">{t.selectDate}</label>
                <input type="date" className="form-input" value={date}
                  onChange={e => setDate(e.target.value)} min={new Date().toISOString().split("T")[0]} />
              </div>
              <div style={{ fontSize:"0.72rem", fontWeight:700, color:"#374151", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:"0.4rem" }}>
                {t.availableSlots}
              </div>
              <div className="slot-grid">
                {SLOTS.map(s => (
                  <div key={s} className={`slot-chip ${slot===s?"selected":""}`}
                    onClick={e => { e.stopPropagation(); setSlot(s); }}>{s}</div>
                ))}
              </div>
              {slot && date && (
                <button className="btn btn-success btn-full mt-3"
                  onClick={e => { e.stopPropagation(); handleBook(); }}>
                  {t.confirmBooking} — {date} {slot}
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AppointmentsTab({ user, t }) {
  const appts = getAppointmentsForPatient(user.id);
  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title">{t.myAppointments}</div>
        <div className="page-desc">{t.allConsultations}</div>
      </div>
      {appts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📅</div>
          <div className="empty-state-text">{t.noAppointmentsYet}</div>
          <div className="empty-state-sub">{t.bookFirstConsultation}</div>
        </div>
      ) : [...appts].reverse().map(a => (
        <div className="card" key={a.id} style={{ marginBottom:"0.5rem" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div style={{ fontWeight:700, color:"#1e293b", fontSize:"0.9rem" }}>{a.doctorName}</div>
              <div style={{ fontSize:"0.75rem", color:"#64748b", marginTop:"0.2rem" }}>{a.specialization}</div>
              <div style={{ fontSize:"0.75rem", color:"#64748b" }}>{a.date} · {a.time}</div>
            </div>
            <span className={`badge ${a.status==="Confirmed"?"badge-green":a.status==="Completed"?"badge-gray":"badge-yellow"}`}>
              {a.status}
            </span>
          </div>
          {a.status==="Confirmed" && (
            <button className="btn btn-primary btn-sm mt-3 btn-full">{t.joinConsultationBtn}</button>
          )}
        </div>
      ))}
    </div>
  );
}

function RecordsTab({ user, t }) {
  const [view, setView] = useState("ehr");
  const [reportName, setReportName] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const ehr = getEHRForPatient(user.id);
  const rx = getPrescriptionsForPatient(user.id);
  const reports = getReportsForPatient(user.id);

  const handleUpload = () => {
    if (!file || !reportName.trim()) return;
    setUploading(true);
    setTimeout(() => {
      saveReport({ id:genId(), patientId:user.id, name:reportName.trim(), fileName:file.name, fileType:file.type, size:file.size, uploadedAt:new Date().toLocaleString("en-IN") });
      setReportName(""); setFile(null); setUploading(false); setUploadDone(true);
      setTimeout(() => setUploadDone(false), 2500);
    }, 1000);
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title">{t.healthRecordsTitle}</div>
      </div>
      <div className="tab-bar">
        {[["ehr",t.ehrRecords],["rx",t.prescriptions],["upload",t.uploadReports]].map(([id,label]) => (
          <button key={id} className={`tab-btn ${view===id?"active":""}`} onClick={() => setView(id)}>{label}</button>
        ))}
      </div>

      {view==="ehr" && (ehr.length===0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📁</div>
          <div className="empty-state-text">{t.noHealthRecords}</div>
          <div className="empty-state-sub">{t.recordsAppearAfterConsultation}</div>
        </div>
      ) : [...ehr].reverse().map(r => (
        <div className="card" key={r.id} style={{ marginBottom:"0.5rem" }}>
          <div style={{ fontWeight:700, color:"#1e293b", fontSize:"0.9rem" }}>{r.diagnosis}</div>
          <div style={{ fontSize:"0.72rem", color:"#64748b", margin:"0.2rem 0 0.5rem" }}>{r.doctorName} · {r.date}</div>
          <div style={{ fontSize:"0.82rem", color:"#374151", lineHeight:1.6 }}>{r.notes}</div>
        </div>
      )))}

      {view==="rx" && (rx.length===0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">💊</div>
          <div className="empty-state-text">{t.noPrescriptions}</div>
          <div className="empty-state-sub">{t.prescriptionsAppearAfterConsultation}</div>
        </div>
      ) : [...rx].reverse().map(p => (
        <div className="card" key={p.id} style={{ marginBottom:"0.5rem" }}>
          <div style={{ fontWeight:700, color:"#1e293b", fontSize:"0.9rem" }}>Prescription</div>
          <div style={{ fontSize:"0.72rem", color:"#64748b", margin:"0.2rem 0 0.5rem" }}>{p.doctorName} · {p.date}</div>
          <ul style={{ paddingLeft:"1rem", fontSize:"0.82rem", color:"#374151", lineHeight:2 }}>
            {p.medications.map((m,i) => <li key={i}>{m.name} {m.dosage} — {m.frequency}, {m.duration}</li>)}
          </ul>
          {p.notes && <div style={{ fontSize:"0.78rem", color:"#64748b", marginTop:"0.4rem" }}>{p.notes}</div>}
        </div>
      )))}

      {view==="upload" && (
        <>
          <div className="card" style={{ marginBottom:"0.75rem" }}>
            <div style={{ fontWeight:700, fontSize:"0.9rem", color:"#1e293b", marginBottom:"0.75rem" }}>{t.uploadMedicalReport}</div>
            <div style={{ fontSize:"0.78rem", color:"#64748b", marginBottom:"0.75rem" }}>{t.uploadDesc}</div>
            <div className="form-group">
              <label className="form-label">{t.reportName}</label>
              <input className="form-input" placeholder={t.reportNamePlaceholder} value={reportName} onChange={e => setReportName(e.target.value)} />
            </div>
            <label className="upload-area" style={{ display:"block" }}>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => setFile(e.target.files[0])} />
              <div className="upload-icon">📎</div>
              <div className="upload-text">{file ? file.name : t.selectFile}</div>
              <div className="upload-hint">PDF, JPG, PNG, DOC — max 10 MB</div>
            </label>
            {uploadDone && <div className="alert alert-success mt-3">{t.reportUploaded}</div>}
            <button className="btn btn-primary btn-full mt-3" onClick={handleUpload}
              disabled={uploading || !file || !reportName.trim()}>
              {uploading ? t.uploading : t.uploadReport}
            </button>
          </div>
          <div className="section-header"><div className="section-title">{t.myReports}</div></div>
          {reports.length===0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📎</div>
              <div className="empty-state-text">{t.noReportsYet}</div>
            </div>
          ) : [...reports].reverse().map(r => (
            <div className="report-item" key={r.id}>
              <div className="report-icon">📄</div>
              <div className="report-body">
                <div className="report-name">{r.name}</div>
                <div className="report-meta">{r.fileName} · {t.uploadedOn} {r.uploadedAt}</div>
              </div>
              <span className="badge badge-blue">{t.viewReport}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function VideoTab({ user, t }) {
  const [joined, setJoined] = useState(false);
  const appts = getAppointmentsForPatient(user.id).filter(a => a.status==="Confirmed");
  if (appts.length===0) return (
    <div className="page-content">
      <div className="page-header"><div className="page-title">{t.videoConsultation}</div></div>
      <div className="empty-state" style={{ marginTop:"2rem" }}>
        <div className="empty-state-icon">🎥</div>
        <div className="empty-state-text">{t.noActiveConsultations}</div>
        <div className="empty-state-sub">{t.bookAppointmentFirst}</div>
      </div>
    </div>
  );
  const appt = appts[0];
  return (
    <div className="page-content">
      <div className="page-header"><div className="page-title">{t.videoConsultation}</div></div>
      {!joined ? (
        <div className="card" style={{ textAlign:"center", padding:"1.5rem 1rem" }}>
          <div style={{ fontWeight:700, fontSize:"0.95rem", marginBottom:"0.25rem" }}>{appt.doctorName}</div>
          <div style={{ fontSize:"0.78rem", color:"#64748b", marginBottom:"1rem" }}>{appt.date} · {appt.time}</div>
          <div className="alert alert-info" style={{ textAlign:"left", fontSize:"0.75rem" }}>{t.encryptedSession}</div>
          <button className="btn btn-primary btn-full mt-3" onClick={() => setJoined(true)}>{t.joinNow}</button>
        </div>
      ) : (
        <div className="card">
          <div style={{ background:"#0f172a", borderRadius:"0.6rem", height:240, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:"0.9rem" }}>
            <div style={{ textAlign:"center", color:"#fff" }}>
              <div style={{ fontWeight:600, fontSize:"0.9rem" }}>{appt.doctorName}</div>
              <div style={{ fontSize:"0.72rem", color:"#94a3b8", marginTop:"0.25rem" }}>Connected · WebRTC</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:"0.5rem", justifyContent:"center" }}>
            <button className="btn btn-ghost btn-sm">{t.mute}</button>
            <button className="btn btn-ghost btn-sm">{t.camera}</button>
            <button className="btn btn-danger btn-sm" onClick={() => setJoined(false)}>{t.endCall}</button>
          </div>
        </div>
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
    { label:t.age,            value:user.age||"—" },
    { label:t.location,       value:user.location||"—" },
    { label:t.contactNo,      value:user.contact||"—" },
    { label:t.medicalHistory, value:user.medicalHistory||"—" },
    { label:t.memberSince,    value:user.joinedAt?new Date(user.joinedAt).toLocaleDateString("en-IN"):"—" },
  ];
  return (
    <div className="page-content">
      <div style={{ textAlign:"center", marginBottom:"1.25rem" }}>
        <div className="avatar avatar-green" style={{ width:64, height:64, fontSize:"1.5rem", margin:"0 auto 0.6rem" }}>{initials}</div>
        <div style={{ fontWeight:800, fontSize:"1rem" }}>{user.name}</div>
        <span className="badge badge-green mt-1">{t.patient}</span>
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

export default function PatientDashboard() {
  const { user } = useAuth();
  const { t, lang, switchLang } = useLang();
  const [tab, setTab] = useState("home");
  const NAV = [
    { id:"home",    label:t.home    },
    { id:"triage",  label:t.triage  },
    { id:"book",    label:t.book    },
    { id:"records", label:t.records },
    { id:"profile", label:t.profile },
  ];
  const NAV_ICONS = { home:"🏠", triage:"🔬", book:"📅", records:"📁", profile:"👤" };
  const render = () => {
    switch(tab) {
      case "home":         return <HomeTab user={user} t={t} setTab={setTab} />;
      case "triage":       return <TriageTab user={user} t={t} lang={lang} />;
      case "book":         return <BookTab user={user} t={t} />;
      case "appointments": return <AppointmentsTab user={user} t={t} />;
      case "records":      return <RecordsTab user={user} t={t} />;
      case "video":        return <VideoTab user={user} t={t} />;
      case "profile":      return <ProfileTab user={user} t={t} />;
      default:             return <HomeTab user={user} t={t} setTab={setTab} />;
    }
  };
  return (
    <>
      <TopBar user={user} t={t} lang={lang} switchLang={switchLang} />
      {render()}
      <nav className="bottom-nav">
        {NAV.map(n => (
          <button key={n.id} className={`bottom-nav-item ${tab===n.id?"nav-active-green":""}`} onClick={() => setTab(n.id)}>
            <span className="bottom-nav-icon">{NAV_ICONS[n.id]}</span>
            <span className="bottom-nav-label">{n.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
