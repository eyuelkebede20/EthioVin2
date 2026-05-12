import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { authClient } from "./lib/auth-client";
import LoginPage from "./pages/LoginPage";
import ScannerPage from "./pages/ScannerPage";
import AdminDashboard from "./pages/AdminDashboard";
import HistoryPage from "./pages/HistoryPage";
import Navbar from "./components/Navbar";

export default function App() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!session) return <LoginPage />;

  const isAdmin = session.user.role === "super_admin";

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-100">
        {/* You will need to update Navbar to use <Link to="..."> instead of onViewChange state */}
        <Navbar isAdmin={isAdmin} />
        <main>
          <Routes>
            <Route path="/" element={<Navigate to="/scan" replace />} />
            <Route path="/scan" element={<ScannerPage />} />
            <Route path="/history/:vin" element={<HistoryPage />} />
            <Route path="/admin" element={isAdmin ? <AdminDashboard /> : <Navigate to="/scan" replace />} />
            {/* Catch-all redirect for bad URLs */}
            <Route path="*" element={<Navigate to="/scan" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
