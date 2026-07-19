import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import type { ReactElement } from "react";
import { authClient } from "./lib/auth-client";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import ScannerPage from "./pages/ScannerPage";
import AdminDashboard from "./pages/AdminDashboard";
import HistoryPage from "./pages/HistoryPage";
import BulkAddPage from "./pages/BulkAddPage";
import Navbar from "./components/Navbar";
import { canVerify } from "./lib/roles";

export default function App() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return <div className="flex h-screen items-center justify-center">Loading...</div>;

  const isAuthed = !!session;
  const isAdmin = session?.user.role === "super_admin";
  const isVerifier = canVerify(session?.user.role);

  // Guard app routes: send signed-out visitors to /login (not the landing), so the
  // deep link they wanted resumes after auth-less bounce.
  const requireAuth = (el: ReactElement) => (isAuthed ? el : <Navigate to="/login" replace />);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-base-200">
        <Navbar isAdmin={!!isAdmin} isVerifier={isVerifier} />
        <main>
          <Routes>
            {/* Public: signed-in users skip the marketing page straight to the scanner. */}
            <Route path="/" element={isAuthed ? <Navigate to="/scan" replace /> : <LandingPage />} />
            <Route path="/login" element={isAuthed ? <Navigate to="/scan" replace /> : <LoginPage />} />

            {/* Authenticated app. */}
            <Route path="/scan" element={requireAuth(<ScannerPage />)} />
            <Route path="/bulk" element={requireAuth(isVerifier ? <BulkAddPage /> : <Navigate to="/scan" replace />)} />
            <Route path="/history/:vin" element={requireAuth(<HistoryPage />)} />
            <Route path="/admin" element={requireAuth(isAdmin ? <AdminDashboard /> : <Navigate to="/scan" replace />)} />

            {/* Unknown URL: home when signed out, scanner when signed in. */}
            <Route path="*" element={<Navigate to={isAuthed ? "/scan" : "/"} replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
