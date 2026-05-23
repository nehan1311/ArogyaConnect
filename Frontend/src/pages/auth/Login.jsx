import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useLang } from "../../App";
import { LANGUAGES } from "../../i18n";
import { apiLogin } from "../../api";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t, lang, switchLang } = useLang();

  const [role, setRole]         = useState("patient");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const roles = [
    { id: "patient", icon: "👤", label: t.patient },
    { id: "doctor",  icon: "⚕️", label: t.doctor  },
    { id: "admin",   icon: "🔐", label: t.admin   },
  ];

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      const data = await apiLogin({ email: email.trim().toLowerCase(), password });

      // data.user.role comes back as "PATIENT" | "DOCTOR" | "ADMIN"
      const serverRole = (data.user.role || "").toLowerCase();

      // Guard: make sure the selected role matches what the server returned
      if (serverRole !== role) {
        setError(`This account is registered as a ${serverRole}, not a ${role}.`);
        setLoading(false);
        return;
      }

      // Doctor pending approval
      if (serverRole === "doctor" && data.user.isApproved === false) {
        setError("Your account is pending admin verification. You will be notified once approved.");
        setLoading(false);
        return;
      }

      login(data.accessToken, data.user);

      if (serverRole === "patient") navigate("/patient-dashboard");
      else if (serverRole === "doctor") navigate("/doctor-dashboard");
      else navigate("/admin-dashboard");

    } catch (err) {
      // Map common HTTP status codes to friendly messages
      if (err.status === 423) {
        setError("Account locked after too many failed attempts. Try again in 15 minutes.");
      } else if (err.status === 403) {
        setError("Account deactivated. Please contact support.");
      } else {
        setError(err.message || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-header">
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:"1rem" }}>
          <div className="lang-toggle">
            {LANGUAGES.map(l => (
              <button key={l.code} className={`lang-btn ${lang === l.code ? "active" : ""}`}
                onClick={() => switchLang(l.code)}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
        <span className="auth-app-name">{t.appName}</span>
        <p className="auth-tagline">{t.tagline}</p>
      </div>

      <div className="auth-body">
        <div className="auth-section-title">{t.welcomeBack}</div>
        <div className="auth-section-sub">{t.signInToAccount}</div>

        {/* Role selector */}
        <div className="role-grid">
          {roles.map(r => (
            <div key={r.id} className={`role-tile ${role === r.id ? "selected" : ""}`}
              onClick={() => { setRole(r.id); setError(""); }}>
              <div className="role-tile-icon">{r.icon}</div>
              <div className="role-tile-label">{r.label}</div>
            </div>
          ))}
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">{t.email}</label>
            <input type="email" className="form-input" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="form-group">
            <label className="form-label">{t.password}</label>
            <input type="password" className="form-input" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <button type="submit" className="btn btn-primary btn-full mt-3" disabled={loading}>
            {loading ? t.signingIn : t.signIn}
          </button>
        </form>

        {role !== "admin" && (
          <>
            <div className="sep" />
            <p style={{ textAlign:"center", fontSize:"0.82rem", color:"#64748b" }}>
              {role === "patient" ? "New patient?" : "New doctor?"}{" "}
              <span className="text-blue font-bold cursor-pointer"
                onClick={() => navigate(role === "patient" ? "/patient-signup" : "/doctor-signup")}>
                {t.createAccount}
              </span>
            </p>
          </>
        )}

        {role === "admin" && (
          <p style={{ textAlign:"center", fontSize:"0.78rem", color:"#64748b", marginTop:"0.75rem" }}>
            Use the{" "}
            <span className="text-blue cursor-pointer font-bold"
              onClick={() => navigate("/admin-login")}>
              Admin Portal
            </span>
            {" "}for MFA login.
          </p>
        )}
      </div>
    </div>
  );
}
