import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useLang } from "../../App";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useLang();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfa, setMfa] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = e => {
    e.preventDefault();
    if (email === "admin@arogyaconnect.in" && password === "Admin@123" && mfa === "123456") {
      login({ id: "admin-1", name: "Admin", role: "admin", email });
      navigate("/admin-dashboard");
    } else { setError("Invalid credentials or MFA code."); }
  };

  return (
    <div className="auth-screen">
      <div className="auth-header" style={{ background: "#7f1d1d" }}>
        <span className="auth-app-name">{t.adminPortal}</span>
        <p className="auth-tagline">{t.restrictedAccess}</p>
      </div>
      <div className="auth-body">
        <div className="alert alert-warning">{t.mfaMandatory}</div>
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t.email}</label>
            <input type="email" className="form-input" placeholder="admin@arogyaconnect.in" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.password}</label>
            <input type="password" className="form-input" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.mfaCode}</label>
            <input type="text" className="form-input" placeholder="123456" value={mfa} onChange={e => setMfa(e.target.value)} maxLength={6}
              style={{ letterSpacing: "0.3em", fontWeight: 700, textAlign: "center" }} />
          </div>
          <button type="submit" className="btn btn-full" style={{ background: "#7f1d1d", color: "#fff", fontWeight: 700 }}>
            {t.secureSignIn}
          </button>
        </form>
        <div className="sep" />
        <p style={{ textAlign: "center" }}>
          <span className="text-blue cursor-pointer text-sm" onClick={() => navigate("/")}>{t.backToMainLogin}</span>
        </p>
      </div>
    </div>
  );
}
