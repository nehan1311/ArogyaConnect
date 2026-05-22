import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useLang } from "../../App";
import { findUserByEmail } from "../../store";
import { LANGUAGES } from "../../i18n";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t, lang, switchLang } = useLang();

  const [role, setRole] = useState("patient");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const roles = [
    { id: "patient", icon: "👤", label: t.patient },
    { id: "doctor",  icon: "⚕️", label: t.doctor  },
    { id: "admin",   icon: "🔐", label: t.admin   },
  ];

  const handleLogin = (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) { setError(t.signIn + " — " + t.email + " / " + t.password); return; }
    setLoading(true);
    setTimeout(() => {
      if (role === "admin") {
        if (email === "admin@arogyaconnect.in" && password === "Admin@123") {
          login({ id: "admin-1", name: "Admin", role: "admin", email });
          navigate("/admin-dashboard");
        } else { setError("Invalid admin credentials."); }
        setLoading(false); return;
      }
      const user = findUserByEmail(email);
      if (!user) { setError("No account found. Please sign up."); setLoading(false); return; }
      if (user.role !== role) { setError(`This account is a ${user.role}, not a ${role}.`); setLoading(false); return; }
      if (user.password !== password) { setError("Incorrect password."); setLoading(false); return; }
      if (user.role === "doctor" && user.status !== "active") {
        setError("Account pending admin verification."); setLoading(false); return;
      }
      login(user);
      navigate(user.role === "doctor" ? "/doctor-dashboard" : "/patient-dashboard");
      setLoading(false);
    }, 500);
  };

  return (
    <div className="auth-screen">
      <div className="auth-header">
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
          <div className="lang-toggle">
            {LANGUAGES.map(l => (
              <button key={l.code} className={`lang-btn ${lang === l.code ? "active" : ""}`} onClick={() => switchLang(l.code)}>
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

        {role === "admin" && (
          <div className="alert alert-info mt-3" style={{ fontSize: "0.75rem" }}>
            admin@arogyaconnect.in / Admin@123
          </div>
        )}

        {role !== "admin" && (
          <>
            <div className="sep" />
            <p style={{ textAlign: "center", fontSize: "0.82rem", color: "#64748b" }}>
              {role === "patient" ? "New patient?" : "New doctor?"}{" "}
              <span className="text-blue font-bold cursor-pointer"
                onClick={() => navigate(role === "patient" ? "/patient-signup" : "/doctor-signup")}>
                {t.createAccount}
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
