import { NavLink, useNavigate } from 'react-router-dom';
import { Package, PackageCheck, LogOut } from 'lucide-react';
import AppLogo from '../../components/AppLogo';
import { useAuth } from '../../context/useAuth';

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const { logout, appUser } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="flex flex-col h-svh bg-canvas">
      {/* Header */}
      <header className="flex items-center justify-between bg-surface border-b border-line-subtle px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <AppLogo size={28} />
          <span className="font-semibold text-ink text-sm">GearTrack</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-muted">{appUser?.displayName}</span>
          <button onClick={handleLogout} className="text-ink-faint hover:text-ink-body">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="shrink-0 bg-surface border-t border-line-subtle flex safe-bottom">
        <NavLink
          to="/m/gear"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
              isActive ? 'text-blue-600 dark:text-blue-400' : 'text-ink-faint hover:text-ink-body'
            }`
          }
        >
          <PackageCheck size={22} />
          My Gear
        </NavLink>
        <NavLink
          to="/m/browse"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
              isActive ? 'text-blue-600 dark:text-blue-400' : 'text-ink-faint hover:text-ink-body'
            }`
          }
        >
          <Package size={22} />
          Browse
        </NavLink>
      </nav>
    </div>
  );
}
