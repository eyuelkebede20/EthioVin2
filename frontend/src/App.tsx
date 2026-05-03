import { useState } from "react";
import { authClient } from "./lib/auth-client";
import LoginPage from "./pages/LoginPage";
import ScannerPage from "./pages/ScannerPage";
import AdminDashboard from "./pages/AdminDashboard";
import Navbar from "./components/Navbar";

export default function App() {
  const { data: session, isPending } = authClient.useSession();
  const [currentView, setCurrentView] = useState<"scanner" | "admin">("scanner");

  if (isPending) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!session) return <LoginPage />;

  // Default to admin view if user is super_admin, otherwise force scanner
  const isAdmin = session.user.role === "super_admin";
  const activeView = isAdmin ? currentView : "scanner";

  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar isAdmin={isAdmin} currentView={activeView} onViewChange={setCurrentView} />
      <main>{activeView === "admin" ? <AdminDashboard /> : <ScannerPage />}</main>
    </div>
  );
}
