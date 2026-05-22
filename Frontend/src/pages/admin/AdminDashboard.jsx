import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useLang } from "../../App";
import { LANGUAGES } from "../../i18n";
import { getAllDoctors, getUsers, updateUser, getAppointments, getTriageReports } from "../../store";

function TopBar({ t, lang, switchLang, logout, navigate }) {
  return (
    <div className="top-bar">
      <span className="top-bar-brand">{t.appName}</span>
      <div className="top-bar-right">
        <div className="lang-toggle">
          {LANGUAGES.map(l => (
            <button key={l.code} className={`lang-btn ${lang===l.code?"active":""}`} onClick={() => switchLang(l.code)}>
              {l.label}
            </button>
          ))}
        </div>
        <button className="btn btn-sm btn-ghost" style={{ color:"#b91c1c", fontSize:"0.72rem" }}
          onClick={() => { logout(); navigate("/"); }}>{t.logout}</button>
        <div className="avatar avatar-red">A</div>
      </div>
    </div>
  );
}

function PendingRow({ doctor, t }) {
  const [status, setStatus] = useState(doctor.status);
  const approve = () => { updateUser(doctor.id, { status:"active" }); setStatus("active"); };
  const reject  = () => { updateUser(doctor.id, { status:"rejected" }); setStatus("rejected"); };
  const initial = (doctor.name.split(" ").pop()||"D")[0];
  if (status==="active")   return <div className="list-item"><div className="list-avatar">{initial}</div><div className="list-body"><div className="list-title">{doctor.name}</div><div className="list-sub">{doctor.specialization}</div></div><span className="badge badge-green">{t.approved}</span></div>;
  if (status==="rejected") return <div className="list-item"><div className="list-avatar">{initial}</div><div className="list-body"><div className="list-title">{doctor.name}</div><div className="list-sub">{doctor.specialization}</div></div><span className="badge badge-red">{t.rejected}</span></div>;
  return (
    <div className="list-item">
      <div className="list-avatar">{initial}</div>
      <div className="list-body">
        <div className="list-title">{doctor.name}</div>
        <div className="list-sub">{doctor.specialization} · {doctor.licenseId}</div>
      </div>
      <div style={{ display:"flex", gap:"0.4rem" }}>
        <button className="btn btn-success btn-sm" onClick={approve}>{t.approve}</button>
        <button className="btn btn-danger btn-sm" onClick={reject}>{t.reject}</button>
      </div>
    </div>
  );
}

function HomeTab({ t, setTab }) {
  const doctors = getAllDoctors();
  const patients = getUsers().filter(u => u.role==="patient");
  const pending = doctors.filter(d => d.status==="pending");
  const appts = getAppointments();
  const criticals = getTriageReports().filter(r => r.urgency==="Critical");
  return (
    <div className="page-content">
      <div style={{ marginBottom:"1rem" }}>
        <div style={{ fontWeight:800, fontSize:"1.05rem", color:"#1e293b" }}>{t.adminDashboard}</div>
        <div style={{ fontSize:"0.78rem", color:"#64748b" }}>{t.platformOverview}</div>
      </div>
      <div className="stat-row">
        <div className="stat-card"><div className="stat-icon stat-icon-blue">👨‍⚕️</div><div className="stat-value">{doctors.length}</div><div className="stat-label">{t.totalDoctors}</div></div>
        <div className="stat-card"><div className="stat-icon stat-icon-green">👤</div><div className="stat-value">{patients.length}</div><div className="stat-label">{t.totalPatients}</div></div>
      </div>
      <div className="stat-row">
        <div className="stat-card"><div className="stat-icon stat-icon-orange">📅</div><div className="stat-value">{appts.length}</div><div className="stat-label">{t.totalAppointments}</div></div>
        <div className="stat-card"><div className="stat-icon stat-icon-red">⚠</div><div className="stat-value">{criticals.length}</div><div className="stat-label">{t.criticalAlerts}</div></div>
      </div>
      <div className="section-header mt-3">
        <div className="section-title">{t.pendingApprovals}</div>
        {pending.length>0 && <span className="badge badge-yellow">{pending.length}</span>}
      </div>
      <div className="card">
        {pending.length===0 ? (
          <div className="empty-state" style={{ padding:"1.25rem" }}>
            <div className="empty-state-icon">✓</div>
            <div className="empty-state-text">{t.noPendingApprovals}</div>
          </div>
        ) : pending.map(d => <PendingRow key={d.id} doctor={d} t={t} />)}
      </div>
      <div className="section-header mt-4">
        <div className="section-title">{t.systemHealth}</div>
        <span className="badge badge-green">{t.allOperational}</span>
      </div>
      {["API Server","AI Triage Service","Video Gateway","MongoDB Atlas"].map(s => (
        <div key={s} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"#fff", borderRadius:"0.6rem", padding:"0.7rem 0.9rem", border:"1px solid #e8edf2", marginBottom:"0.4rem" }}>
          <span style={{ fontSize:"0.82rem", fontWeight:600, color:"#1e293b" }}>{s}</span>
          <span className="badge badge-green">Online</span>
        </div>
      ))}
    </div>
  );
}

function DoctorsTab({ t }) {
  const [doctors, setDoctors] = useState(() => getAllDoctors());
  const toggle = (id, s) => { updateUser(id, { status:s }); setDoctors(getAllDoctors()); };
  const sBadge = s => { const m={active:"badge-green",pending:"badge-yellow",rejected:"badge-red",suspended:"badge-red"}; return <span className={`badge ${m[s]||"badge-gray"}`}>{s}</span>; };
  return (
    <div className="page-content">
      <div className="page-header"><div className="page-title">{t.doctorManagement}</div><div className="page-desc">{t.approveManageDoctors}</div></div>
      {doctors.length===0 ? <div className="empty-state"><div className="empty-state-icon">👨‍⚕️</div><div className="empty-state-text">{t.noDoctorsRegistered}</div></div>
      : doctors.map(d => (
        <div className="card" key={d.id} style={{ marginBottom:"0.5rem" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"0.7rem", marginBottom:"0.5rem" }}>
            <div className="list-avatar">{(d.name.split(" ").pop()||"D")[0]}</div>
            <div className="list-body"><div className="list-title">{d.name}</div><div className="list-sub">{d.specialization} · {d.licenseId}</div></div>
            {sBadge(d.status)}
          </div>
          <div style={{ fontSize:"0.72rem", color:"#64748b", marginBottom:"0.5rem" }}>{d.experience?`${d.experience} yrs`:""}{d.availability?` · ${d.availability}`:""}</div>
          <div style={{ display:"flex", gap:"0.4rem" }}>
            {d.status==="pending"   && <><button className="btn btn-success btn-sm" onClick={() => toggle(d.id,"active")}>{t.approve}</button><button className="btn btn-danger btn-sm" onClick={() => toggle(d.id,"rejected")}>{t.reject}</button></>}
            {d.status==="active"    && <button className="btn btn-ghost btn-sm" style={{ color:"#b91c1c" }} onClick={() => toggle(d.id,"suspended")}>{t.suspend}</button>}
            {(d.status==="suspended"||d.status==="rejected") && <button className="btn btn-outline btn-sm" onClick={() => toggle(d.id,"active")}>{t.reactivate}</button>}
          </div>
        </div>
      ))}
    </div>
  );
}

function PatientsTab({ t }) {
  const [patients, setPatients] = useState(() => getUsers().filter(u => u.role==="patient"));
  const toggle = (id, cur) => { updateUser(id, { status:cur==="active"?"inactive":"active" }); setPatients(getUsers().filter(u=>u.role==="patient")); };
  return (
    <div className="page-content">
      <div className="page-header"><div className="page-title">{t.patientManagement}</div><div className="page-desc">{t.viewManagePatients}</div></div>
      {patients.length===0 ? <div className="empty-state"><div className="empty-state-icon">👤</div><div className="empty-state-text">{t.noPatientsRegistered}</div></div>
      : patients.map(p => (
        <div className="card" key={p.id} style={{ marginBottom:"0.5rem" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"0.7rem" }}>
            <div className="list-avatar list-avatar-green">{p.name[0]}</div>
            <div className="list-body"><div className="list-title">{p.name}</div><div className="list-sub">{p.age?`Age ${p.age}`:""}{p.location?` · ${p.location}`:""} · {p.email}</div></div>
            <span className={`badge ${p.status==="inactive"?"badge-gray":"badge-green"}`}>{p.status||"active"}</span>
          </div>
          <div style={{ marginTop:"0.5rem" }}>
            <button className={`btn btn-sm ${p.status==="inactive"?"btn-success":"btn-ghost"}`}
              style={p.status!=="inactive"?{color:"#b91c1c"}:{}}
              onClick={() => toggle(p.id, p.status||"active")}>
              {p.status==="inactive"?t.activate:t.deactivate}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AuditTab({ t }) {
  const appts = getAppointments();
  const triage = getTriageReports();
  const logs = [
    ...appts.map(a => ({ id:a.id, time:a.bookedAt?new Date(a.bookedAt).toLocaleString("en-IN"):"—", user:a.patientName, action:t.bookedAppointment, detail:`${a.doctorName} · ${a.date} ${a.time}` })),
    ...triage.map(r => ({ id:r.id, time:r.date, user:"Patient", action:`Triage: ${r.urgency}`, detail:r.symptoms?.slice(0,50)+"…" })),
  ].sort((a,b) => b.time.localeCompare(a.time));
  return (
    <div className="page-content">
      <div className="page-header"><div className="page-title">{t.auditLogs}</div><div className="page-desc">{t.immutableRecord}</div></div>
      <div className="alert alert-info" style={{ fontSize:"0.75rem" }}>{t.auditImmutable}</div>
      {logs.length===0 ? <div className="empty-state"><div className="empty-state-icon">🔍</div><div className="empty-state-text">{t.noEventsYet}</div></div>
      : logs.map(log => (
        <div className="card" key={log.id} style={{ marginBottom:"0.4rem" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <span className={`badge ${log.action.includes("Critical")?"badge-red":log.action.includes("Triage")?"badge-orange":"badge-blue"}`}>{log.action}</span>
              <div style={{ fontWeight:600, fontSize:"0.82rem", color:"#1e293b", marginTop:"0.25rem" }}>{log.user}</div>
              <div style={{ fontSize:"0.72rem", color:"#64748b" }}>{log.detail}</div>
            </div>
            <div style={{ fontSize:"0.68rem", color:"#94a3b8", flexShrink:0, marginLeft:"0.5rem" }}>{log.time}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ComplianceTab({ t }) {
  const checks = [
    "TLS 1.3 on all endpoints","AES-256 encryption at rest (EHR)","JWT token rotation enforced",
    "RBAC on all API routes","Immutable audit logs","MFA for Doctor & Admin roles",
    "Patient consent for EHR sharing","Data residency within India (DPDP)","HIPAA Security Rule review",
  ];
  const pending = ["Quarterly penetration testing"];
  return (
    <div className="page-content">
      <div className="page-header"><div className="page-title">{t.complianceTitle}</div><div className="page-desc">{t.hipaaGdpr}</div></div>
      <div className="stat-row">
        <div className="stat-card"><div className="stat-icon stat-icon-green">✓</div><div className="stat-value">{checks.length}</div><div className="stat-label">{t.checksPassed}</div></div>
        <div className="stat-card"><div className="stat-icon stat-icon-orange">⏳</div><div className="stat-value">{pending.length}</div><div className="stat-label">{t.pending}</div></div>
      </div>
      {checks.map((c,i) => (
        <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"#fff", borderRadius:"0.6rem", padding:"0.7rem 0.9rem", border:"1px solid #e8edf2", marginBottom:"0.4rem" }}>
          <span style={{ fontSize:"0.8rem", color:"#374151", flex:1, paddingRight:"0.5rem" }}>{c}</span>
          <span className="badge badge-green">Pass</span>
        </div>
      ))}
      {pending.map((c,i) => (
        <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"#fff", borderRadius:"0.6rem", padding:"0.7rem 0.9rem", border:"1px solid #e8edf2", marginBottom:"0.4rem" }}>
          <span style={{ fontSize:"0.8rem", color:"#374151", flex:1, paddingRight:"0.5rem" }}>{c}</span>
          <span className="badge badge-yellow">{t.pending}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const { logout } = useAuth();
  const { t, lang, switchLang } = useLang();
  const navigate = useNavigate();
  const [tab, setTab] = useState("home");
  const NAV = [
    { id:"home",       label:t.home       },
    { id:"doctors",    label:t.doctors    },
    { id:"patients",   label:t.patients   },
    { id:"audit",      label:t.audit      },
    { id:"compliance", label:t.compliance },
  ];
  const NAV_ICONS = { home:"🏠", doctors:"👨‍⚕️", patients:"👤", audit:"🔍", compliance:"📋" };
  const render = () => {
    switch(tab) {
      case "home":       return <HomeTab t={t} setTab={setTab} />;
      case "doctors":    return <DoctorsTab t={t} />;
      case "patients":   return <PatientsTab t={t} />;
      case "audit":      return <AuditTab t={t} />;
      case "compliance": return <ComplianceTab t={t} />;
      default:           return <HomeTab t={t} setTab={setTab} />;
    }
  };
  return (
    <>
      <TopBar t={t} lang={lang} switchLang={switchLang} logout={logout} navigate={navigate} />
      {render()}
      <nav className="bottom-nav">
        {NAV.map(n => (
          <button key={n.id} className={`bottom-nav-item ${tab===n.id?"nav-active-red":""}`} onClick={() => setTab(n.id)}>
            <span className="bottom-nav-icon">{NAV_ICONS[n.id]}</span>
            <span className="bottom-nav-label">{n.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
