import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { createContext, useContext, useState, useEffect } from "react";
import { getCurrentUser, setCurrentUser as persistUser, logout as storeLogout } from "./store";
import { translations } from "./i18n";

import Login from "./pages/auth/Login";
import PatientSignup from "./pages/auth/PatientSignup";
import DoctorSignup from "./pages/auth/DoctorSignup";
import AdminLogin from "./pages/auth/AdminLogin";
import PatientDashboard from "./pages/patient/PatientDashboard";
import DoctorDashboard from "./pages/doctor/DoctorDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";

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

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getCurrentUser());

  const login = (userData) => { persistUser(userData); setUser(userData); };
  const logout = () => { storeLogout(); setUser(null); };

  useEffect(() => {
    const onStorage = () => setUser(getCurrentUser());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

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
              <Route path="/" element={<Login />} />
              <Route path="/patient-signup" element={<PatientSignup />} />
              <Route path="/doctor-signup" element={<DoctorSignup />} />
              <Route path="/admin-login" element={<AdminLogin />} />
              <Route path="/patient-dashboard" element={<Protected role="patient"><PatientDashboard /></Protected>} />
              <Route path="/doctor-dashboard" element={<Protected role="doctor"><DoctorDashboard /></Protected>} />
              <Route path="/admin-dashboard" element={<Protected role="admin"><AdminDashboard /></Protected>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </div>
      </AuthProvider>
    </LangProvider>
  );
}

export default App;
