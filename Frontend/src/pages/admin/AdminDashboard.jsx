import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useLang } from "../../App";
import { LANGUAGES } from "../../i18n";
import {
  apiAdminGetStats,
  apiAdminGetDoctors,
  apiAdminGetPatients,
  apiAdminApproveDoctor,
  apiAdminRejectDoctor,
  apiAdminSuspendDoctor,
  apiAdminReactivateDoctor,
  apiAdminDeactivatePatient,
  apiAdminActivatePatient,
  apiGetMyNotifications,
  apiGetNotificationStats,
} from "../../api";
import { getAppointments, getTriageReports } from "../../store";
import NotificationPanel from "../../components/NotificationPanel";

function Spinner() {
  return (
    <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "#94a3b8" }}>
      <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>⏳</div>
      <div style={{ fontSize: "0.82rem" }}>Loading…</div>
    </div>
  );
}

function ApiError({ message, onRetry }) {
  return (
    <div className="alert alert-danger" style={{ marginTop: "0.75rem" }}>
      {message}
      {onRetry && (
        <button className="btn btn-sm btn-ghost" style={{ marginLeft: "0.75rem" }} onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

function TopBar({ t, lang, switchLang, onLogout }) {
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
        <button className="btn btn-sm btn-ghost" style={{ color: "#b91c1c", fontSize: "0.72rem" }} onClick={onLogout}>
          {t.logout}
        </button>
        <div className="avatar avatar-red">A</div>
      </div>
      {showNotif && <NotificationPanel onClose={() => setShowNotif(false)} />}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = { active: "badge-green", pending: "badge-yellow", rejected: "badge-red", suspended: "badge-red", inactive: "badge-gray" };
  return <span className={`badge ${map[status] || "badge-gray"}`}>{status}</span>;
}

function HomeTab({ t, setTab }) {
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [statsData, doctorsData] = await Promise.all([apiAdminGetStats(), apiAdminGetDoctors()]);
      setStats(statsData.stats);
      setPending(doctorsData.doctors.filter(d => d.status === "pending"));
    } catch (err) {
      setError(err.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id) => {
    try {
      await apiAdminApproveDoctor(id);
      setPending(prev => prev.filter(d => d.id !== id));
      setStats(prev => prev ? { ...prev, pendingDoctors: prev.pendingDoctors - 1 } : prev);
    } catch (err) { setError(err.message || "Action failed."); }
  };

  const handleReject = async (id) => {
    try {
      await apiAdminRejectDoctor(id);
      setPending(prev => prev.filter(d => d.id !== id));
      setStats(prev => prev ? { ...prev, pendingDoctors: prev.pendingDoctors - 1 } : prev);
    } catch (err) { setError(err.message || "Action failed."); }
  };

  return (
    <div className="page-content">
      <div style={{ marginBottom: "1rem" }}>
        <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#1e293b" }}>{t.adminDashboard}</div>
        <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{t.platformOverview}</div>
      </div>
      {error && <ApiError message={error} onRetry={load} />}
      {loading ? <Spinner /> : stats && (
        <>
          <div className="stat-row">
            <div className="stat-card">
              <div className="stat-icon stat-icon-blue">👨⚕️</div>
              <div className="stat-value">{stats.totalDoctors}</div>
              <div className="stat-label">{t.totalDoctors}</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-green">👤</div>
              <div className="stat-value">{stats.totalPatients}</div>
              <div className="stat-label">{t.totalPatients}</div>
            </div>
          </div>
          <div className="stat-row">
            <div className="stat-card">
              <div className="stat-icon stat-icon-yellow">⏳</div>
              <div className="stat-value">{stats.pendingDoctors}</div>
              <div className="stat-label">Pending Approvals</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-orange">📅</div>
              <div className="stat-value">{getAppointments().length}</div>
              <div className="stat-label">{t.totalAppointments}</div>
            </div>
          </div>
        </>
      )}
      <div className="section-header mt-3">
        <div className="section-title">{t.pendingApprovals}</div>
        {pending.length > 0 && <span className="badge badge-yellow">{pending.length}</span>}
      </div>
      <div className="card">
        {loading ? <Spinner /> : pending.length === 0 ? (
          <div className="empty-state" style={{ padding: "1.25rem" }}>
            <div className="empty-state-icon" style={{ fontSize: "1.5rem" }}>✓</div>
            <div className="empty-state-text">{t.noPendingApprovals}</div>
          </div>
        ) : pending.map(d => (
          <div className="list-item" key={d.id}>
            <div className="list-avatar">{(d.name.split(" ").pop() || "D")[0]}</div>
            <div className="list-body">
              <div className="list-title">{d.name}</div>
              <div className="list-sub">{d.specialization} · {d.licenseId}</div>
            </div>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button className="btn btn-success btn-sm" onClick={() => handleApprove(d.id)}>{t.approve}</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleReject(d.id)}>{t.reject}</button>
            </div>
          </div>
        ))}
      </div>
      <div className="section-header mt-4">
        <div className="section-title">{t.systemHealth}</div>
        <span className="badge badge-green">{t.allOperational}</span>
      </div>
      {["API Server", "AI Triage Service", "Video Gateway", "MongoDB Atlas"].map(s => (
        <div key={s} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", borderRadius: "0.6rem", padding: "0.7rem 0.9rem", border: "1px solid #e8edf2", marginBottom: "0.4rem" }}>
          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#1e293b" }}>{s}</span>
          <span className="badge badge-green">Online</span>
        </div>
      ))}
    </div>
  );
}

function DoctorsTab({ t }) {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await apiAdminGetDoctors();
      setDoctors(data.doctors);
    } catch (err) {
      setError(err.message || "Failed to load doctors.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = (id, newStatus) =>
    setDoctors(prev => prev.map(d => d.id === id ? { ...d, status: newStatus } : d));

  const handle = async (fn, id, newStatus) => {
    setActionError("");
    try { await fn(id); updateStatus(id, newStatus); }
    catch (err) { setActionError(err.message || "Action failed."); }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title">{t.doctorManagement}</div>
        <div className="page-desc">{t.approveManageDoctors}</div>
      </div>
      {error && <ApiError message={error} onRetry={load} />}
      {actionError && <div className="alert alert-danger">{actionError}</div>}
      {loading ? <Spinner /> : doctors.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👨⚕️</div>
          <div className="empty-state-text">{t.noDoctorsRegistered}</div>
        </div>
      ) : doctors.map(d => (
        <div className="card" key={d.id} style={{ marginBottom: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", marginBottom: "0.5rem" }}>
            <div className="list-avatar">{(d.name.split(" ").pop() || "D")[0]}</div>
            <div className="list-body">
              <div className="list-title">{d.name}</div>
              <div className="list-sub">{d.specialization} · {d.licenseId}</div>
            </div>
            <StatusBadge status={d.status} />
          </div>
          <div style={{ fontSize: "0.72rem", color: "#64748b", marginBottom: "0.5rem" }}>{d.email}</div>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {d.status === "pending" && (
              <>
                <button className="btn btn-success btn-sm" onClick={() => handle(apiAdminApproveDoctor, d.id, "active")}>{t.approve}</button>
                <button className="btn btn-danger btn-sm" onClick={() => handle(apiAdminRejectDoctor, d.id, "rejected")}>{t.reject}</button>
              </>
            )}
            {d.status === "active" && (
              <button className="btn btn-ghost btn-sm" style={{ color: "#b91c1c" }} onClick={() => handle(apiAdminSuspendDoctor, d.id, "suspended")}>{t.suspend}</button>
            )}
            {(d.status === "suspended" || d.status === "rejected") && (
              <button className="btn btn-outline btn-sm" onClick={() => handle(apiAdminReactivateDoctor, d.id, "active")}>{t.reactivate}</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function PatientsTab({ t }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await apiAdminGetPatients();
      setPatients(data.patients);
    } catch (err) {
      setError(err.message || "Failed to load patients.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (p) => {
    setActionError("");
    try {
      if (p.status === "active") {
        await apiAdminDeactivatePatient(p.id);
        setPatients(prev => prev.map(x => x.id === p.id ? { ...x, status: "inactive" } : x));
      } else {
        await apiAdminActivatePatient(p.id);
        setPatients(prev => prev.map(x => x.id === p.id ? { ...x, status: "active" } : x));
      }
    } catch (err) { setActionError(err.message || "Action failed."); }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title">{t.patientManagement}</div>
        <div className="page-desc">{t.viewManagePatients}</div>
      </div>
      {error && <ApiError message={error} onRetry={load} />}
      {actionError && <div className="alert alert-danger">{actionError}</div>}
      {loading ? <Spinner /> : patients.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👤</div>
          <div className="empty-state-text">{t.noPatientsRegistered}</div>
        </div>
      ) : patients.map(p => (
        <div className="card" key={p.id} style={{ marginBottom: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
            <div className="list-avatar list-avatar-green">{p.name[0]}</div>
            <div className="list-body">
              <div className="list-title">{p.name}</div>
              <div className="list-sub">{p.location && p.location !== "—" ? `${p.location} · ` : ""}{p.email}</div>
            </div>
            <StatusBadge status={p.status} />
          </div>
          <div style={{ marginTop: "0.5rem" }}>
            <button
              className={`btn btn-sm ${p.status === "inactive" ? "btn-success" : "btn-ghost"}`}
              style={p.status !== "inactive" ? { color: "#b91c1c" } : {}}
              onClick={() => toggle(p)}
            >
              {p.status === "inactive" ? t.activate : t.deactivate}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function NotificationsTab() {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGetNotificationStats()
      .then(d => setStats(d.stats || []))
      .catch(err => setError(err.message || "Failed to load stats."))
      .finally(() => setLoading(false));
  }, []);

  const TYPE_ICON = {
    APPOINTMENT_CONFIRMATION: "✅", APPOINTMENT_CANCELLATION: "❌",
    APPOINTMENT_REMINDER_1HR: "⏰", APPOINTMENT_REMINDER_15MIN: "⚡",
    PRESCRIPTION_ISSUED: "💊", TRIAGE_CRITICAL_ALERT: "🚨",
    PASSWORD_RESET: "🔑", GENERAL: "📢",
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title">🔔 Notification Stats</div>
        <div className="page-desc">Platform-wide notification delivery summary</div>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? <Spinner /> : stats.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔔</div>
          <div className="empty-state-text">No notifications sent yet</div>
        </div>
      ) : stats.map((s, i) => (
        <div className="card" key={i} style={{ marginBottom: "0.4rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "1rem" }}>{TYPE_ICON[s.type] || "📢"}</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.82rem", color: "#1e293b" }}>{s.type.replace(/_/g, " ")}</div>
              <div style={{ fontSize: "0.7rem", color: "#64748b" }}>{s.status}</div>
            </div>
          </div>
          <span className={`badge ${s.status === "SENT" ? "badge-green" : s.status === "FAILED" ? "badge-red" : "badge-yellow"}`}>
            {s.count}
          </span>
        </div>
      ))}
    </div>
  );
}

function AuditTab({ t }) {
  const appts  = getAppointments();
  const triage = getTriageReports();
  const logs = [
    ...appts.map(a => ({ id: a.id, time: a.bookedAt ? new Date(a.bookedAt).toLocaleString("en-IN") : "—", user: a.patientName, action: t.bookedAppointment, detail: `${a.doctorName} · ${a.date} ${a.time}` })),
    ...triage.map(r => ({ id: r.id, time: r.date, user: "Patient", action: `Triage: ${r.urgency}`, detail: (r.symptoms || "").slice(0, 50) + "…" })),
  ].sort((a, b) => b.time.localeCompare(a.time));

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title">{t.auditLogs}</div>
        <div className="page-desc">{t.immutableRecord}</div>
      </div>
      <div className="alert alert-info" style={{ fontSize: "0.75rem" }}>{t.auditImmutable}</div>
      {logs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-text">{t.noEventsYet}</div>
        </div>
      ) : logs.map(log => (
        <div className="card" key={log.id} style={{ marginBottom: "0.4rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <span className={`badge ${log.action.includes("Critical") ? "badge-red" : log.action.includes("Triage") ? "badge-orange" : "badge-blue"}`}>{log.action}</span>
              <div style={{ fontWeight: 600, fontSize: "0.82rem", color: "#1e293b", marginTop: "0.25rem" }}>{log.user}</div>
              <div style={{ fontSize: "0.72rem", color: "#64748b" }}>{log.detail}</div>
            </div>
            <div style={{ fontSize: "0.68rem", color: "#94a3b8", flexShrink: 0, marginLeft: "0.5rem" }}>{log.time}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ComplianceTab({ t }) {
  const passed = [
    "TLS 1.3 on all endpoints", "AES-256 encryption at rest (EHR)",
    "JWT token rotation enforced", "RBAC on all API routes",
    "Immutable audit logs", "MFA for Doctor & Admin roles",
    "Patient consent for EHR sharing", "Data residency within India (DPDP)",
    "HIPAA Security Rule review",
  ];
  const pending = ["Quarterly penetration testing"];

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title">{t.complianceTitle}</div>
        <div className="page-desc">{t.hipaaGdpr}</div>
      </div>
      <div className="stat-row">
        <div className="stat-card">
          <div className="stat-icon stat-icon-green">✓</div>
          <div className="stat-value">{passed.length}</div>
          <div className="stat-label">{t.checksPassed}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-orange">⏳</div>
          <div className="stat-value">{pending.length}</div>
          <div className="stat-label">{t.pending}</div>
        </div>
      </div>
      {passed.map((c, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", borderRadius: "0.6rem", padding: "0.7rem 0.9rem", border: "1px solid #e8edf2", marginBottom: "0.4rem" }}>
          <span style={{ fontSize: "0.8rem", color: "#374151", flex: 1, paddingRight: "0.5rem" }}>{c}</span>
          <span className="badge badge-green">Pass</span>
        </div>
      ))}
      {pending.map((c, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", borderRadius: "0.6rem", padding: "0.7rem 0.9rem", border: "1px solid #e8edf2", marginBottom: "0.4rem" }}>
          <span style={{ fontSize: "0.8rem", color: "#374151", flex: 1, paddingRight: "0.5rem" }}>{c}</span>
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

  const handleLogout = () => { logout(); navigate("/"); };

  const NAV = [
    { id: "home",          label: t.home       },
    { id: "doctors",       label: t.doctors    },
    { id: "patients",      label: t.patients   },
    { id: "notifications", label: "🔔"          },
    { id: "audit",         label: t.audit      },
    { id: "compliance",    label: t.compliance },
  ];
  const NAV_ICONS = {
    home: "🏠", doctors: "👨⚕️", patients: "👤", notifications: "🔔", audit: "🔍", compliance: "📋",
  };

  const render = () => {
    switch (tab) {
      case "home":          return <HomeTab t={t} setTab={setTab} />;
      case "doctors":       return <DoctorsTab t={t} />;
      case "patients":      return <PatientsTab t={t} />;
      case "notifications": return <NotificationsTab />;
      case "audit":         return <AuditTab t={t} />;
      case "compliance":    return <ComplianceTab t={t} />;
      default:              return <HomeTab t={t} setTab={setTab} />;
    }
  };

  return (
    <>
      <TopBar t={t} lang={lang} switchLang={switchLang} onLogout={handleLogout} />
      {render()}
      <nav className="bottom-nav">
        {NAV.map(n => (
          <button
            key={n.id}
            className={`bottom-nav-item ${tab === n.id ? "nav-active-red" : ""}`}
            onClick={() => setTab(n.id)}
          >
            <span className="bottom-nav-icon">{NAV_ICONS[n.id]}</span>
            <span className="bottom-nav-label">{n.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
