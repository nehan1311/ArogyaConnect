import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useLang } from "../../App";
import { apiLogin } from "../../api";

/**
 * AdminLogin — two-step: password login via real API, then client-side MFA check.
 *
 * The backend does not have a dedicated MFA service yet, so MFA is validated
 * client-side as a placeholder (code = "123456"). When a real TOTP service is
 * added to the backend, replace the mfa check with an API call.
 *
 * Admin credentials are seeded via:  npm run seed:admin  (in the backend)
 * Default: admin@arogyaconnect.in / Admin@1234
 */
export default function AdminLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useLang();

  const [step, setStep]         = useState("credentials"); // "credentials" | "mfa"
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [mfa, setMfa]           = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  // Temporary storage between step 1 and step 2
  const [pendingToken, setPendingToken] = useState(null);
  const [pendingUser,  setPendingUser]  = useState(null);

  // ── Step 1: verify credentials against the real backend ──────────
  const handleCredentials = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);
    try {
      const data = await apiLogin({
        email:    email.trim().toLowerCase(),
        password,
      });

      // Ensure the account is actually ADMIN
      if ((data.user.role || "").toUpperCase() !== "ADMIN") {
        setError("This account does not have admin privileges.");
        setLoading(false);
        return;
      }

      // Store token + user temporarily; don't commit to context until MFA passes
      setPendingToken(data.accessToken);
      setPendingUser(data.user);
      setStep("mfa");
    } catch (err) {
      if (err.status === 423) {
        setError("Account locked after too many failed attempts. Try again in 15 minutes.");
      } else if (err.status === 403) {
        setError("Account deactivated. Contact support.");
      } else {
        setError(err.message || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: validate MFA code (placeholder — replace with TOTP API) ──
  const handleMfa = (e) => {
    e.preventDefault();
    setError("");

    // TODO: replace with real TOTP verification endpoint when available
    const VALID_MFA = "123456";
    if (mfa !== VALID_MFA) {
      setError("Invalid MFA code. (Use 123456 for now)");
      return;
    }

    // Commit to auth context — user is fully authenticated
    login(pendingToken, pendingUser);
    navigate("/admin-dashboard");
  };

  return (
    <div className="auth-screen">
      {/* Header */}
      <div className="auth-header" style={{ background: "#7f1d1d" }}>
        <span className="auth-app-name">{t.adminPortal}</span>
        <p className="auth-tagline">{t.restrictedAccess}</p>
      </div>

      <div className="auth-body">
        {/* Step indicator */}
        <div style={{ display:"flex", gap:"0.5rem", marginBottom:"1.25rem" }}>
          {["credentials","mfa"].map((s, i) => (
            <div key={s} style={{ display:"flex", alignItems:"center", gap:"0.4rem" }}>
              <div style={{
                width:24, height:24, borderRadius:"50%",
                background: step === s || (s === "credentials" && step === "mfa") ? "#7f1d1d" : "#e2e8f0",
                color: step === s || (s === "credentials" && step === "mfa") ? "#fff" : "#94a3b8",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:"0.72rem", fontWeight:700,
              }}>
                {s === "credentials" && step === "mfa" ? "✓" : i + 1}
              </div>
              <span style={{ fontSize:"0.72rem", fontWeight:600, color: step === s ? "#7f1d1d" : "#94a3b8" }}>
                {s === "credentials" ? "Credentials" : "MFA"}
              </span>
              {i === 0 && <span style={{ color:"#e2e8f0", margin:"0 0.2rem" }}>›</span>}
            </div>
          ))}
        </div>

        <div className="alert alert-warning" style={{ fontSize:"0.78rem" }}>
          {t.mfaMandatory}
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        {/* ── Step 1: Email + Password ── */}
        {step === "credentials" && (
          <form onSubmit={handleCredentials}>
            <div className="form-group">
              <label className="form-label">{t.email}</label>
              <input
                type="email"
                className="form-input"
                placeholder="admin@arogyaconnect.in"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t.password}</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              className="btn btn-full"
              style={{ background:"#7f1d1d", color:"#fff", fontWeight:700 }}
              disabled={loading}
            >
              {loading ? "Verifying…" : "Continue"}
            </button>
          </form>
        )}

        {/* ── Step 2: MFA Code ── */}
        {step === "mfa" && (
          <form onSubmit={handleMfa}>
            <div style={{ textAlign:"center", marginBottom:"1rem" }}>
              <div style={{ fontSize:"0.85rem", color:"#374151" }}>
                Signed in as <strong>{email}</strong>
              </div>
              <div style={{ fontSize:"0.78rem", color:"#64748b", marginTop:"0.2rem" }}>
                Enter your 6-digit authenticator code
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t.mfaCode}</label>
              <input
                type="text"
                className="form-input"
                placeholder="123456"
                value={mfa}
                onChange={e => setMfa(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                style={{ letterSpacing:"0.4em", fontWeight:700, textAlign:"center", fontSize:"1.2rem" }}
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="btn btn-full"
              style={{ background:"#7f1d1d", color:"#fff", fontWeight:700 }}
            >
              {t.secureSignIn}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-full mt-2"
              onClick={() => { setStep("credentials"); setError(""); setMfa(""); }}
            >
              Back
            </button>
          </form>
        )}

        <div className="sep" />
        <p style={{ textAlign:"center" }}>
          <span
            className="text-blue cursor-pointer text-sm"
            onClick={() => navigate("/")}
          >
            {t.backToMainLogin}
          </span>
        </p>
      </div>
    </div>
  );
}
