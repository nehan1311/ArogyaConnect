import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { createContext, useContext, useState, useEffect } from "react";
import { translations } from "./i18n";
import { getToken, setToken, clearToken, apiGetMe } from "./api";

import Login         from "./pages/auth/Login";
import PatientSignup from "./pages/auth/PatientSignup";
import DoctorSignup  from "./pages/auth/DoctorSignup";
import AdminLogin    from "./pages/auth/AdminLogin";
import PatientDashboard from "./pages/patient/PatientDashboard";
import DoctorDashboard  from "./pages/doctor/DoctorDashboard";
import AdminDashboard   from "./pages/admin/AdminDashboard";

// ── Language Context ─────────────────────────────────────────────
export const LangContext = createContext(null);
export function useLang() { return useContext(LangContext); }

function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("ac_lang") || "en");
  const t = translations[lang] || translations.en;
  const switchLang = (code) => { setLang(code); localStorage.setItem("ac_lang", code); };
  return (
    <LangContext.Provider value={{ lang, t, switchLang }}>
      {children}
    </LangContext.Provider>
  );
}

// ── Auth Context ─────────────────────────────────────────────────
export const AuthContext = createContext(null);
export function useAuth() { return useContext(AuthContext); }

// Normalise backend user → frontend user shape
// Backend: role = "PATIENT" | "DOCTOR" | "ADMIN"
// Frontend routes expect: role = "patient" | "doctor" | "admin"
function normaliseUser(backendUser) {
  if (!backendUser) return null;
  return {
    ...backendUser,
    // keep original _id as id if present
    id: backendUser.id || backendUser._id,
    // lowercase role for route matching
    role: (backendUser.role || "").toLowerCase(),
    // map isApproved → status so existing dashboard code still works
    status: backendUser.isApproved === false ? "pending" : "active",
  };
}

function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true); // true while we verify token on mount

  // On mount: if we have a stored token, verify it with /api/auth/me
  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }

    apiGetMe()
      .then((data) => setUser(normaliseUser(data.user)))
      .catch(() => { clearToken(); })
      .finally(() => setLoading(false));
  }, []);

  /**
   * Called after a successful login/register API response.
   * Stores the access token and sets the user in context.
   */
  const login = (accessToken, backendUser) => {
    setToken(accessToken);
    setUser(normaliseUser(backendUser));
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  if (loading) {
    // Minimal splash while we verify the stored token
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100dvh", background:"#fff" }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:"1.5rem", fontWeight:800, color:"#1e40af", marginBottom:"0.5rem" }}>ArogyaConnect</div>
          <div style={{ fontSize:"0.82rem", color:"#64748b" }}>Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Protected Route ──────────────────────────────────────────────
function Protected({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

// ── App ──────────────────────────────────────────────────────────
function App() {
  return (
    <LangProvider>
      <AuthProvider>
        <div className="app-shell">
          <BrowserRouter>
            <Routes>
              <Route path="/"               element={<Login />} />
              <Route path="/patient-signup" element={<PatientSignup />} />
              <Route path="/doctor-signup"  element={<DoctorSignup />} />
              <Route path="/admin-login"    element={<AdminLogin />} />

              <Route path="/patient-dashboard" element={
                <Protected role="patient"><PatientDashboard /></Protected>
              } />
              <Route path="/doctor-dashboard" element={
                <Protected role="doctor"><DoctorDashboard /></Protected>
              } />
              <Route path="/admin-dashboard" element={
                <Protected role="admin"><AdminDashboard /></Protected>
              } />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </div>
      </AuthProvider>
    </LangProvider>
  );
}

export default App;
