import { Link, useLocation } from "react-router-dom";
import { authClient } from "../lib/auth-client";

interface NavbarProps {
  isAdmin: boolean;
}

export default function Navbar({ isAdmin }: NavbarProps) {
  const { data: session } = authClient.useSession();
  const location = useLocation();

  const handleLogout = async () => {
    await authClient.signOut();
    window.location.href = "/";
  };

  if (!session) return null;

  return (
    <nav className="flex justify-between items-center p-4 bg-slate-900 text-white">
      <div className="flex items-center gap-6">
        {/* Logo Placeholder */}
        <div className="flex items-center gap-2 font-bold text-xl tracking-wider">
          <div className="w-8 h-8 bg-orange-600 rounded flex items-center justify-center font-mono">EV</div>
          EthioVin
        </div>

        {/* Navigation */}
        {isAdmin && (
          <div className="flex gap-2 bg-slate-800 p-1 rounded-lg">
            <Link
              to="/scan"
              className={`px-4 py-1 rounded transition-colors ${location.pathname.startsWith("/scan") || location.pathname.startsWith("/history") ? "bg-slate-600" : "hover:bg-slate-700"}`}
            >
              Scanner
            </Link>
            <Link to="/admin" className={`px-4 py-1 rounded transition-colors ${location.pathname.startsWith("/admin") ? "bg-slate-600" : "hover:bg-slate-700"}`}>
              Dashboard
            </Link>
          </div>
        )}
      </div>

      <div className="flex gap-4 items-center">
        <span className="text-sm bg-slate-700 px-2 py-1 rounded">{session.user.role}</span>
        <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-bold text-sm">
          Logout
        </button>
      </div>
    </nav>
  );
}
