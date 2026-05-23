import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useLang } from "../../App";
import { LANGUAGES } from "../../i18n";
import {
  apiSearchDoctors, apiGetDoctorSlots, apiBookAppointment,
  apiGetMyAppointments, apiCancelAppointment, apiGetMyNotifications,
  apiGetMyEHR, apiGenerateShareToken, apiRevokeShareToken, apiGetEHRAuditLogs,
  apiGetMyPrescriptions, apiRequestRefill,
} from "../../api";
import {
  getEHRForPatient, getPrescriptionsForPatient, getTriageForPatient,
  saveTriageReport, getReportsForPatient, saveReport, genId,
} from "../../store";
import NotificationPanel from "../../components/NotificationPanel";
import PatientAppointmentsPanel from "../../components/PatientAppointmentsPanel";
import { PatientVideoTab } from "../../components/VideoConsultation";

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
            <button key={l.code} className={`lang-btn ${lang === l.code ? "active" : ""}`} onClick={() => switchLang(l.code)}>
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
        <div className="avatar avatar-green">{initials}</div>
      </div>
      {showNotif && <NotificationPanel onClose={() => setShowNotif(false)} />}
    </div>
  );
}

function HomeTab({ user, t, setTab }) {
  const [appointments, setAppointments] = useState([]);
  const [triageCount, setTriageCount] = useState(0);
  const firstName = user.name.split(" ")[0];

  useEffect(() => {
    apiGetMyAppointments().then(d => setAppointments(d.appointments || [])).catch(() => {});
    setTriageCount(getTriageForPatient(user.id).length);
  }, [user.id]);

  const upcoming = appointments.filter(a => a.status !== "COMPLETED" && a.status !== "CANCELLED");

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
          <div className="stat-value">{triageCount}</div>
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
          <div className="list-item" key={a._id}>
            <div className="list-avatar">{(a.doctor?.name||"D")[0]}</div>
            <div className="list-body">
              <div className="list-title">{a.doctor?.name}</div>
              <div className="list-sub">{a.doctor?.profile?.specialization} · {new Date(a.date).toLocaleDateString("en-IN")} {a.startTime}</div>
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
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [selected, setSelected] = useState(null);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slot, setSlot] = useState("");
  const [notes, setNotes] = useState("");
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(null);
  const [error, setError] = useState("");

  const searchDoctors = useCallback(async () => {
    setLoadingDoctors(true);
    setError("");
    try {
      const data = await apiSearchDoctors({ name: search, specialization: search });
      setDoctors(data.doctors || []);
    } catch (err) {
      setError(err.message || "Failed to load doctors.");
    } finally {
      setLoadingDoctors(false);
    }
  }, [search]);

  useEffect(() => { searchDoctors(); }, []);

  const fetchSlots = useCallback(async (doctorId, selectedDate) => {
    if (!doctorId || !selectedDate) return;
    setLoadingSlots(true);
    setSlots([]);
    setSlot("");
    try {
      const data = await apiGetDoctorSlots(doctorId, selectedDate);
      setSlots(data.slots || []);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  const handleSelectDoctor = (doc) => {
    setSelected(doc);
    setSlot("");
    setSlots([]);
    setDate("");
    setError("");
  };

  const handleDateChange = (e) => {
    setDate(e.target.value);
    if (selected) fetchSlots(selected.id, e.target.value);
  };

  const handleBook = async () => {
    if (!slot || !date || !notes.trim()) {
      setError("Please select a slot and add a reason for visit.");
      return;
    }
    setBooking(true);
    setError("");
    try {
      const data = await apiBookAppointment({
        doctorId: selected.id,
        date,
        startTime: slot.startTime,
        notes: notes.trim(),
      });
      setBooked(data.appointment);
    } catch (err) {
      setError(err.message || "Booking failed.");
    } finally {
      setBooking(false);
    }
  };

  if (booked) return (
    <div className="page-content">
      <div className="success-screen">
        <div className="success-icon">✓</div>
        <div className="success-title">{t.appointmentConfirmed}</div>
        <div className="success-sub">
          {booked.doctor?.name}<br/>
          {new Date(booked.date).toLocaleDateString("en-IN")} · {booked.startTime} – {booked.endTime}<br/>
          {t.appointmentConfirmedDesc}
        </div>
        <button className="btn btn-primary btn-full mt-4"
          onClick={() => { setBooked(null); setSelected(null); setSlot(""); setDate(""); setNotes(""); }}>
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
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="form-group" style={{ display:"flex", gap:"0.5rem" }}>
        <input className="form-input" placeholder={t.searchDoctorPlaceholder}
          value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === "Enter" && searchDoctors()} />
        <button className="btn btn-primary btn-sm" onClick={searchDoctors} disabled={loadingDoctors}>
          {loadingDoctors ? "⏳" : "🔍"}
        </button>
      </div>

      {doctors.length === 0 && !loadingDoctors && (
        <div className="empty-state">
          <div className="empty-state-icon">👨‍⚕️</div>
          <div className="empty-state-text">{t.noVerifiedDoctors}</div>
          <div className="empty-state-sub">{t.doctorsAppearedOnceApproved}</div>
        </div>
      )}

      {doctors.map(doc => (
        <div key={doc.id} className={`doctor-card ${selected?.id === doc.id ? "selected" : ""}`}
          onClick={() => handleSelectDoctor(doc)}>
          <div style={{ display:"flex", alignItems:"center", gap:"0.7rem" }}>
            <div className="list-avatar">{(doc.name.split(" ").pop()||"D")[0]}</div>
            <div className="list-body">
              <div className="list-title">{doc.name}</div>
              <div className="list-sub">{doc.profile?.specialization}</div>
            </div>
          </div>

          {selected?.id === doc.id && (
            <div style={{ marginTop:"0.85rem" }} onClick={e => e.stopPropagation()}>
              <div className="form-group">
                <label className="form-label">{t.selectDate}</label>
                <input type="date" className="form-input" value={date}
                  onChange={handleDateChange}
                  min={new Date().toISOString().split("T")[0]} />
              </div>

              {loadingSlots && <div style={{ fontSize:"0.78rem", color:"#64748b" }}>⏳ Loading slots…</div>}

              {!loadingSlots && date && slots.length === 0 && (
                <div className="alert alert-warning" style={{ fontSize:"0.78rem" }}>No available slots for this date.</div>
              )}

              {slots.length > 0 && (
                <>
                  <div style={{ fontSize:"0.72rem", fontWeight:700, color:"#374151", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:"0.4rem" }}>
                    {t.availableSlots}
                  </div>
                  <div className="slot-grid">
                    {slots.map(s => (
                      <div key={s.startTime}
                        className={`slot-chip ${slot?.startTime === s.startTime ? "selected" : ""}`}
                        onClick={() => setSlot(s)}>
                        {s.startTime}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {slot && (
                <div className="form-group mt-3">
                  <label className="form-label">Reason for visit *</label>
                  <textarea className="form-textarea" style={{ minHeight:70 }}
                    placeholder="Describe your symptoms or reason…"
                    value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
              )}

              {slot && date && (
                <button className="btn btn-success btn-full mt-2"
                  onClick={handleBook} disabled={booking || !notes.trim()}>
                  {booking ? "⏳ Booking…" : `${t.confirmBooking} — ${date} ${slot.startTime}`}
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
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGetMyAppointments();
      setAppointments(data.appointments || []);
    } catch (err) {
      setError(err.message || "Failed to load appointments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async (id) => {
    setCancellingId(id);
    try {
      await apiCancelAppointment(id, "Cancelled by patient");
      setAppointments(prev => prev.map(a => a._id === id ? { ...a, status: "CANCELLED" } : a));
    } catch (err) {
      setError(err.message || "Cancel failed.");
    } finally {
      setCancellingId(null);
    }
  };

  const statusBadge = (s) => {
    const map = { CONFIRMED:"badge-green", COMPLETED:"badge-gray", CANCELLED:"badge-red", IN_PROGRESS:"badge-blue", REQUESTED:"badge-yellow" };
    return map[s] || "badge-gray";
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title">{t.myAppointments}</div>
        <div className="page-desc">{t.allConsultations}</div>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? (
        <div className="empty-state"><div style={{ fontSize:"1.5rem" }}>⏳</div></div>
      ) : appointments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📅</div>
          <div className="empty-state-text">{t.noAppointmentsYet}</div>
          <div className="empty-state-sub">{t.bookFirstConsultation}</div>
        </div>
      ) : appointments.map(a => (
        <div className="card" key={a._id} style={{ marginBottom:"0.5rem" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div style={{ fontWeight:700, color:"#1e293b", fontSize:"0.9rem" }}>{a.doctor?.name}</div>
              <div style={{ fontSize:"0.75rem", color:"#64748b", marginTop:"0.2rem" }}>{a.doctor?.profile?.specialization}</div>
              <div style={{ fontSize:"0.75rem", color:"#64748b" }}>
                {new Date(a.date).toLocaleDateString("en-IN")} · {a.startTime} – {a.endTime}
              </div>
              {a.notes && <div style={{ fontSize:"0.72rem", color:"#94a3b8", marginTop:"0.2rem" }}>Note: {a.notes}</div>}
            </div>
            <span className={`badge ${statusBadge(a.status)}`}>{a.status}</span>
          </div>
          {(a.status === "CONFIRMED" || a.status === "REQUESTED") && (
            <div style={{ display:"flex", gap:"0.5rem", marginTop:"0.75rem" }}>
              <button className="btn btn-primary btn-sm btn-full">{t.joinConsultationBtn}</button>
              <button className="btn btn-ghost btn-sm" style={{ color:"#b91c1c", flexShrink:0 }}
                disabled={cancellingId === a._id}
                onClick={() => handleCancel(a._id)}>
                {cancellingId === a._id ? "⏳" : "Cancel"}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RecordsTab({ user, t }) {
  const [view, setView] = useState("ehr");
  const [ehr, setEhr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Share token state
  const [doctors, setDoctors] = useState([]);
  const [shareDocId, setShareDocId] = useState("");
  const [shareHours, setShareHours] = useState(48);
  const [sharing, setSharing] = useState(false);
  const [sharedToken, setSharedToken] = useState("");
  const [revoking, setRevoking] = useState("");

  // Audit log state
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Prescriptions state
  const [prescriptions, setPrescriptions] = useState([]);
  const [rxLoading, setRxLoading] = useState(false);
  const [rxFilter, setRxFilter] = useState("");
  const [refillingId, setRefillingId] = useState("");

  const loadEHR = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await apiGetMyEHR();
      setEhr(data.ehr);
    } catch (err) {
      setError(err.message || "Failed to load health records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEHR(); }, [loadEHR]);

  useEffect(() => {
    if (view === "share") {
      apiSearchDoctors().then(d => setDoctors(d.doctors || [])).catch(() => {});
    }
    if (view === "audit") {
      setAuditLoading(true);
      apiGetEHRAuditLogs(user.id)
        .then(d => setAuditLogs(d.logs || []))
        .catch(() => {})
        .finally(() => setAuditLoading(false));
    }
    if (view === "rx") {
      setRxLoading(true);
      apiGetMyPrescriptions(rxFilter ? { status: rxFilter } : {})
        .then(d => setPrescriptions(d.prescriptions || []))
        .catch(() => {})
        .finally(() => setRxLoading(false));
    }
  }, [view, user.id, rxFilter]);

  const handleShare = async () => {
    if (!shareDocId) return;
    setSharing(true); setSharedToken("");
    try {
      const data = await apiGenerateShareToken(shareDocId, shareHours);
      setSharedToken(data.shareToken);
      await loadEHR();
    } catch (err) {
      setError(err.message || "Failed to generate share token.");
    } finally {
      setSharing(false);
    }
  };

  const handleRevoke = async (tokenId) => {
    setRevoking(tokenId);
    try {
      await apiRevokeShareToken(tokenId);
      await loadEHR();
    } catch (err) {
      setError(err.message || "Failed to revoke token.");
    } finally {
      setRevoking("");
    }
  };

  const handleRefill = async (prescriptionId) => {
    setRefillingId(prescriptionId);
    try {
      const data = await apiRequestRefill(prescriptionId);
      setPrescriptions(prev => prev.map(p =>
        p._id === prescriptionId ? data.prescription : p
      ));
    } catch (err) {
      setError(err.message || "Refill failed.");
    } finally {
      setRefillingId("");
    }
  };

  const ENTRY_ICON = { CONSULTATION:"🩺", DIAGNOSIS:"🔬", LAB_REPORT:"📋", PRESCRIPTION:"💊", VACCINATION:"💉", GENERAL_NOTE:"📝" };

  const renderEntryContent = (entry) => {
    if (entry.type === "PRESCRIPTION") {
      try {
        const data = JSON.parse(entry.content);
        return (
          <div>
            {data.diagnosis && <div style={{fontWeight:600,marginBottom:"0.3rem"}}>Diagnosis: {data.diagnosis}</div>}
            {Array.isArray(data.medications) && data.medications.length > 0 && (
              <ul style={{paddingLeft:"1rem",lineHeight:1.9,margin:"0.3rem 0"}}>
                {data.medications.map((m, i) => (
                  <li key={i}>
                    {m.name} {m.dosage} — {m.frequency}, {m.duration}
                    {m.instructions && <span style={{color:"#64748b"}}> ({m.instructions})</span>}
                  </li>
                ))}
              </ul>
            )}
            {data.notes && <div style={{color:"#64748b",marginTop:"0.3rem"}}>Note: {data.notes}</div>}
          </div>
        );
      } catch {
        // not JSON, fall through to plain text
      }
    }
    return <span>{entry.content}</span>;
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title">{t.healthRecordsTitle}</div>
      </div>
      <div className="tab-bar">
        {[["ehr","EHR"],["rx","💊 Rx"],["share","🔗 Share"],["audit","🔍 Audit"]].map(([id,label]) => (
          <button key={id} className={`tab-btn ${view===id?"active":""}`} onClick={() => setView(id)}>{label}</button>
        ))}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* ── EHR Entries ── */}
      {view==="ehr" && (
        loading ? <div className="empty-state"><div style={{fontSize:"1.5rem"}}>⏳</div></div>
        : !ehr || ehr.entries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📁</div>
            <div className="empty-state-text">{t.noHealthRecords}</div>
            <div className="empty-state-sub">{t.recordsAppearAfterConsultation}</div>
          </div>
        ) : (
          <>
            {ehr.bloodGroup && ehr.bloodGroup !== "UNKNOWN" && (
              <div className="card" style={{ marginBottom:"0.6rem", display:"flex", gap:"1rem" }}>
                <div><div style={{fontSize:"0.68rem",color:"#94a3b8",fontWeight:700,textTransform:"uppercase"}}>Blood Group</div>
                  <div style={{fontWeight:800,fontSize:"1.1rem",color:"#b91c1c"}}>{ehr.bloodGroup}</div></div>
                {ehr.allergies?.length > 0 && <div><div style={{fontSize:"0.68rem",color:"#94a3b8",fontWeight:700,textTransform:"uppercase"}}>Allergies</div>
                  <div style={{fontSize:"0.82rem",color:"#374151"}}>{ehr.allergies.join(", ")}</div></div>}
              </div>
            )}
            {[...ehr.entries].reverse().map(e => (
              <div className="card" key={e._id} style={{ marginBottom:"0.5rem" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", marginBottom:"0.4rem" }}>
                  <span style={{fontSize:"1.1rem"}}>{ENTRY_ICON[e.type]||"📄"}</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,color:"#1e293b",fontSize:"0.9rem"}}>{e.title}</div>
                    <div style={{fontSize:"0.7rem",color:"#64748b"}}>{e.doctorName} · {new Date(e.date).toLocaleDateString("en-IN")}</div>
                  </div>
                  <span className="badge badge-blue" style={{fontSize:"0.62rem"}}>{e.type.replace("_"," ")}</span>
                </div>
                <div style={{fontSize:"0.82rem",color:"#374151",lineHeight:1.6,background:"#f8fafc",borderRadius:"0.5rem",padding:"0.6rem"}}>
                  {renderEntryContent(e)}
                </div>
              </div>
            ))}
          </>
        )
      )}

      {/* ── Prescriptions ── */}
      {view==="rx" && (
        <>
          <div style={{ display:"flex", gap:"0.4rem", marginBottom:"0.75rem", flexWrap:"wrap" }}>
            {["","ACTIVE","COMPLETED","CANCELLED"].map(s => (
              <button key={s} className={`btn btn-sm ${rxFilter===s?"btn-primary":"btn-ghost"}`}
                onClick={() => setRxFilter(s)}>
                {s || "All"}
              </button>
            ))}
          </div>
          {rxLoading ? (
            <div className="empty-state"><div style={{fontSize:"1.5rem"}}>⏳</div></div>
          ) : prescriptions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">💊</div>
              <div className="empty-state-text">{t.noPrescriptions}</div>
              <div className="empty-state-sub">{t.prescriptionsAppearAfterConsultation}</div>
            </div>
          ) : prescriptions.map(p => {
            const expired = new Date() > new Date(p.validUntil);
            const canRefill = p.status === "ACTIVE" && !expired && p.refillsUsed < p.refillsAllowed;
            const STATUS_BADGE = { ACTIVE:"badge-green", COMPLETED:"badge-gray", CANCELLED:"badge-red" };
            return (
              <div className="card" key={p._id} style={{ marginBottom:"0.5rem" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"0.4rem" }}>
                  <div>
                    <div style={{ fontWeight:700, color:"#1e293b", fontSize:"0.9rem" }}>{p.diagnosis}</div>
                    <div style={{ fontSize:"0.7rem", color:"#64748b" }}>Dr. {p.doctor?.name} · {new Date(p.issuedAt).toLocaleDateString("en-IN")}</div>
                    <div style={{ fontSize:"0.7rem", color: expired ? "#b91c1c" : "#64748b" }}>
                      {expired ? "⚠️ Expired" : `Valid until ${new Date(p.validUntil).toLocaleDateString("en-IN")}`}
                    </div>
                    {p.refillsAllowed > 0 && (
                      <div style={{ fontSize:"0.7rem", color:"#64748b" }}>
                        Refills: {p.refillsUsed}/{p.refillsAllowed} used
                      </div>
                    )}
                  </div>
                  <span className={`badge ${STATUS_BADGE[p.status] || "badge-gray"}`}>{p.status}</span>
                </div>
                <ul style={{ paddingLeft:"1rem", fontSize:"0.8rem", color:"#374151", lineHeight:1.9, marginBottom: canRefill ? "0.5rem" : 0 }}>
                  {p.medications.map((m, i) => (
                    <li key={i}>{m.name} {m.dosage} — {m.frequency}, {m.duration}
                      {m.instructions && <span style={{color:"#64748b"}}> ({m.instructions})</span>}
                    </li>
                  ))}
                </ul>
                {p.notes && <div style={{ fontSize:"0.75rem", color:"#64748b", marginBottom:"0.5rem" }}>{p.notes}</div>}
                {canRefill && (
                  <button className="btn btn-outline btn-sm"
                    disabled={refillingId === p._id}
                    onClick={() => handleRefill(p._id)}>
                    {refillingId === p._id ? "⏳" : `🔄 Request Refill (${p.refillsAllowed - p.refillsUsed} left)`}
                  </button>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* ── Share Token Management ── */}
      {view==="share" && (
        <>
          <div className="card" style={{marginBottom:"0.75rem"}}>
            <div style={{fontWeight:700,fontSize:"0.9rem",color:"#1e293b",marginBottom:"0.75rem"}}>🔗 Share EHR with a Doctor</div>
            <div className="alert alert-info" style={{fontSize:"0.75rem",marginBottom:"0.75rem"}}>
              Generate a one-time token to grant a doctor temporary read access to your EHR.
            </div>
            <div className="form-group">
              <label className="form-label">Select Doctor *</label>
              <select className="form-select" value={shareDocId} onChange={e => setShareDocId(e.target.value)}>
                <option value="">Choose a doctor…</option>
                {doctors.map(d => <option key={d.id} value={d.id}>{d.name} — {d.profile?.specialization}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Expires in (hours)</label>
              <select className="form-select" value={shareHours} onChange={e => setShareHours(Number(e.target.value))}>
                {[6,12,24,48,72].map(h => <option key={h} value={h}>{h} hours</option>)}
              </select>
            </div>
            {sharedToken && (
              <div className="alert alert-success" style={{marginBottom:"0.75rem"}}>
                <div style={{fontWeight:700,marginBottom:"0.3rem"}}>✅ Token generated — share this once only:</div>
                <div style={{fontFamily:"monospace",fontSize:"0.72rem",wordBreak:"break-all",background:"#f0fdf4",padding:"0.5rem",borderRadius:"0.4rem"}}>{sharedToken}</div>
              </div>
            )}
            <button className="btn btn-primary btn-full" onClick={handleShare} disabled={sharing || !shareDocId}>
              {sharing ? "⏳ Generating…" : "Generate Share Token"}
            </button>
          </div>

          {/* Active tokens */}
          {ehr?.shareTokens?.filter(tk => !tk.isRevoked && new Date(tk.expiresAt) > new Date()).length > 0 && (
            <>
              <div className="section-header"><div className="section-title">Active Tokens</div></div>
              {ehr.shareTokens.filter(tk => !tk.isRevoked && new Date(tk.expiresAt) > new Date()).map(tk => (
                <div className="card" key={tk._id} style={{marginBottom:"0.5rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:"0.82rem",fontWeight:600,color:"#1e293b"}}>Expires {new Date(tk.expiresAt).toLocaleString("en-IN")}</div>
                    {tk.accessedAt && <div style={{fontSize:"0.7rem",color:"#64748b"}}>Last accessed {new Date(tk.accessedAt).toLocaleString("en-IN")}</div>}
                  </div>
                  <button className="btn btn-danger btn-sm" disabled={revoking===tk._id}
                    onClick={() => handleRevoke(tk._id)}>
                    {revoking===tk._id ? "⏳" : "Revoke"}
                  </button>
                </div>
              ))}
            </>
          )}
        </>
      )}

      {/* ── Audit Log ── */}
      {view==="audit" && (
        auditLoading ? <div className="empty-state"><div style={{fontSize:"1.5rem"}}>⏳</div></div>
        : auditLogs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔍</div>
            <div className="empty-state-text">No audit events yet</div>
          </div>
        ) : auditLogs.map(log => (
          <div className="card" key={log._id} style={{marginBottom:"0.4rem"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <span className={`badge ${log.action.includes("VIEW")?"badge-blue":log.action.includes("SHARE")?"badge-purple":"badge-green"}`}>
                  {log.action}
                </span>
                <div style={{fontSize:"0.75rem",color:"#64748b",marginTop:"0.2rem"}}>
                  {log.actorRole} · {log.ipAddress || "—"}
                </div>
              </div>
              <div style={{fontSize:"0.68rem",color:"#94a3b8",flexShrink:0,marginLeft:"0.5rem"}}>
                {new Date(log.createdAt).toLocaleString("en-IN")}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function VideoTab({ user, t }) {
  const [joined, setJoined] = useState(false);
  const [appointments, setAppointments] = useState([]);

  useEffect(() => {
    apiGetMyAppointments("CONFIRMED").then(d => setAppointments(d.appointments || [])).catch(() => {});
  }, []);

  if (appointments.length === 0) return (
    <div className="page-content">
      <div className="page-header"><div className="page-title">{t.videoConsultation}</div></div>
      <div className="empty-state" style={{ marginTop:"2rem" }}>
        <div className="empty-state-icon">🎥</div>
        <div className="empty-state-text">{t.noActiveConsultations}</div>
        <div className="empty-state-sub">{t.bookAppointmentFirst}</div>
      </div>
    </div>
  );
  const appt = appointments[0];
  return (
    <div className="page-content">
      <div className="page-header"><div className="page-title">{t.videoConsultation}</div></div>
      {!joined ? (
        <div className="card" style={{ textAlign:"center", padding:"1.5rem 1rem" }}>
          <div style={{ fontWeight:700, fontSize:"0.95rem", marginBottom:"0.25rem" }}>{appt.doctor?.name}</div>
          <div style={{ fontSize:"0.78rem", color:"#64748b", marginBottom:"1rem" }}>
            {new Date(appt.date).toLocaleDateString("en-IN")} · {appt.startTime}
          </div>
          <div className="alert alert-info" style={{ textAlign:"left", fontSize:"0.75rem" }}>{t.encryptedSession}</div>
          <button className="btn btn-primary btn-full mt-3" onClick={() => setJoined(true)}>{t.joinNow}</button>
        </div>
      ) : (
        <div className="card">
          <div style={{ background:"#0f172a", borderRadius:"0.6rem", height:240, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:"0.9rem" }}>
            <div style={{ textAlign:"center", color:"#fff" }}>
              <div style={{ fontWeight:600, fontSize:"0.9rem" }}>{appt.doctor?.name}</div>
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
      case "appointments": return <PatientAppointmentsPanel t={t} />;
      case "records":      return <RecordsTab user={user} t={t} />;
      case "video":        return <PatientVideoTab t={t} />;
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
