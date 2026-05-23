import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLang } from "../../App";
import { apiRegister } from "../../api";

const SPECS = [
  "Cardiologist","Dermatologist","General Physician","Gynecologist",
  "Neurologist","Ophthalmologist","Orthopedic","Pediatrician",
  "Psychiatrist","Pulmonologist","Radiologist","Urologist",
];

export default function DoctorSignup() {
  const navigate = useNavigate();
  const { t } = useLang();

  const [form, setForm] = useState({
    name:"", licenseId:"", specialization:"", experience:"",
    availability:"", email:"", password:"", confirm:"",
  });
  const [error, setError]   = useState("");
  const [done, setDone]     = useState(false);
  const [loading, setLoading] = useState(false);
  const set = f => e => setForm({ ...form, [f]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim() || !form.licenseId.trim() || !form.email.trim() || !form.password) {
      setError("Name, License ID, email and password are required."); return;
    }
    if (!form.specialization) {
      setError("Please select a specialization."); return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters."); return;
    }
    if (form.password !== form.confirm) {
      setError("Passwords do not match."); return;
    }

    setLoading(true);
    try {
      await apiRegister({
        name:     form.name.trim(),
        email:    form.email.trim().toLowerCase(),
        password: form.password,
        role:     "DOCTOR",            // backend expects uppercase
        profile: {
          specialization: form.specialization,
          licenseNumber:  form.licenseId.trim(),
        },
      });
      // Doctor is NOT auto-logged in — isApproved = false
      setDone(true);
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

  if (done) return (
    <div className="auth-screen">
      <div className="auth-header">
        <span className="auth-app-name">{t.appName}</span>
      </div>
      <div className="auth-body" style={{ display:"flex", alignItems:"center", justifyContent:"center", flex:1 }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:"3rem", marginBottom:"1rem", color:"#15803d" }}>✓</div>
          <div style={{ fontSize:"1.1rem", fontWeight:800, color:"#1e293b", marginBottom:"0.5rem" }}>
            {t.pendingVerification}
          </div>
          <div style={{ fontSize:"0.85rem", color:"#64748b", lineHeight:1.7, marginBottom:"1.5rem" }}>
            {t.pendingVerificationDesc}
          </div>
          <button className="btn btn-primary btn-full" onClick={() => navigate("/")}>
            {t.backToLogin}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="auth-screen">
      <div className="auth-header">
        <span className="auth-app-name">{t.appName}</span>
        <p className="auth-tagline">{t.doctorRegistration}</p>
      </div>

      <div className="auth-body">
        <div className="auth-section-title">{t.registerAsDoctor}</div>
        <div className="auth-section-sub">{t.verifiedBeforeActivation}</div>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t.fullName} *</label>
            <input type="text" className="form-input" placeholder="Dr. Priya Mehta"
              value={form.name} onChange={set("name")} />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">{t.licenseId} *</label>
              <input type="text" className="form-input" placeholder="MH-2024-12345"
                value={form.licenseId} onChange={set("licenseId")} />
            </div>
            <div className="form-group">
              <label className="form-label">{t.experienceYrs}</label>
              <input type="number" className="form-input" placeholder="5"
                value={form.experience} onChange={set("experience")} min="0" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t.specialization} *</label>
            <select className="form-select" value={form.specialization} onChange={set("specialization")}>
              <option value="">{t.selectSpecialization}</option>
              {SPECS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">{t.availability}</label>
            <input type="text" className="form-input" placeholder={t.availabilityPlaceholder}
              value={form.availability} onChange={set("availability")} />
          </div>

          <div className="form-group">
            <label className="form-label">{t.email} *</label>
            <input type="email" className="form-input" placeholder="doctor@hospital.com"
              value={form.email} onChange={set("email")} />
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

          <div className="alert alert-warning" style={{ fontSize:"0.75rem" }}>
            {t.adminApprovalRequired}
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? t.submitting : t.submitRegistration}
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
