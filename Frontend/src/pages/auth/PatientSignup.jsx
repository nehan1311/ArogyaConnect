import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useLang } from "../../App";
import { apiRegister } from "../../api";

export default function PatientSignup() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useLang();

  const [form, setForm] = useState({
    name:"", age:"", location:"", contact:"",
    medicalHistory:"", email:"", password:"", confirm:"",
  });
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const set = f => e => setForm({ ...form, [f]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError("Name, email and password are required."); return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters."); return;
    }
    if (form.password !== form.confirm) {
      setError("Passwords do not match."); return;
    }

    setLoading(true);
    try {
      const data = await apiRegister({
        name:     form.name.trim(),
        email:    form.email.trim().toLowerCase(),
        password: form.password,
        role:     "PATIENT",           // backend expects uppercase
        profile: {
          phone:   form.contact.trim() || undefined,
          address: form.location.trim() || undefined,
        },
      });

      login(data.accessToken, data.user);
      navigate("/patient-dashboard");
    } catch (err) {
      if (err.status === 409) {
        setError("An account with this email already exists.");
      } else {
        setError(err.message || "Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-header">
        <span className="auth-app-name">{t.appName}</span>
        <p className="auth-tagline">{t.patientRegistration}</p>
      </div>

      <div className="auth-body">
        <div className="auth-section-title">{t.createYourAccount}</div>
        <div className="auth-section-sub">{t.fillDetails}</div>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t.fullName} *</label>
            <input type="text" className="form-input" placeholder="Rahul Sharma"
              value={form.name} onChange={set("name")} autoComplete="name" />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">{t.age}</label>
              <input type="number" className="form-input" placeholder="28"
                value={form.age} onChange={set("age")} min="1" max="120" />
            </div>
            <div className="form-group">
              <label className="form-label">{t.contactNo}</label>
              <input type="tel" className="form-input" placeholder="+91 98765…"
                value={form.contact} onChange={set("contact")} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t.location}</label>
            <input type="text" className="form-input" placeholder="Pune, Maharashtra"
              value={form.location} onChange={set("location")} />
          </div>

          <div className="form-group">
            <label className="form-label">{t.medicalHistory}</label>
            <textarea className="form-textarea" placeholder={t.medHistoryPlaceholder}
              value={form.medicalHistory} onChange={set("medicalHistory")} />
          </div>

          <div className="form-group">
            <label className="form-label">{t.email} *</label>
            <input type="email" className="form-input" placeholder="rahul@example.com"
              value={form.email} onChange={set("email")} autoComplete="email" />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">{t.password} * (min 8)</label>
              <input type="password" className="form-input" placeholder="Min 8 chars"
                value={form.password} onChange={set("password")} />
            </div>
            <div className="form-group">
              <label className="form-label">{t.confirmPassword} *</label>
              <input type="password" className="form-input" placeholder="Repeat"
                value={form.confirm} onChange={set("confirm")} />
            </div>
          </div>

          <div className="alert alert-info" style={{ fontSize:"0.75rem" }}>
            {t.dataProtected}
          </div>

          <button type="submit" className="btn btn-success btn-full" disabled={loading}>
            {loading ? t.creatingAccount : t.createAccount}
          </button>
        </form>

        <div className="sep" />
        <p style={{ textAlign:"center", fontSize:"0.82rem", color:"#64748b" }}>
          {t.alreadyHaveAccount}{" "}
          <span className="text-blue font-bold cursor-pointer" onClick={() => navigate("/")}>
            {t.signIn}
          </span>
        </p>
      </div>
    </div>
  );
}
