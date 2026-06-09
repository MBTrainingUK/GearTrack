import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Layers,
  CalendarRange,
  ArrowLeftRight,
  History,
  LogOut,
  Menu,
  Shield,
  BarChart2,
  Activity,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/useAuth';
import type { AppUser } from '../types';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true, minRole: 'user' },
  { to: '/items', label: 'Items', icon: Package, minRole: 'user' },
  { to: '/kits', label: 'Kits', icon: Layers, minRole: 'user' },
  { to: '/reservations', label: 'Reservations', icon: CalendarRange, minRole: 'user' },
  { to: '/checkouts', label: 'Checkouts', icon: ArrowLeftRight, minRole: 'user' },
  { to: '/history', label: 'My History', icon: History, minRole: 'user' },
  { to: '/activity', label: 'Activity', icon: Activity, minRole: 'manager' },
  { to: '/reports', label: 'Reports', icon: BarChart2, minRole: 'admin' },
  { to: '/admin', label: 'Admin', icon: Shield, minRole: 'admin' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { appUser, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 flex-shrink-0 border-r border-gray-200 bg-white lg:flex lg:flex-col">
        <SidebarContent appUser={appUser} onNavigate={() => setMobileOpen(false)} onLogout={handleLogout} />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/30"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-50 w-56 bg-white shadow-xl">
            <SidebarContent appUser={appUser} onNavigate={() => setMobileOpen(false)} onLogout={handleLogout} />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="flex h-14 items-center gap-3 border-b border-gray-200 bg-white px-4 lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-gray-500 hover:text-gray-900"
          >
            <Menu size={20} />
          </button>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
            <Package size={14} className="text-white" />
          </div>
          <span className="font-bold text-gray-900">GearTrack</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-5">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({
  appUser,
  onNavigate,
  onLogout,
}: {
  appUser: AppUser | null;
  onNavigate: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-gray-100 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
          <Package size={16} className="text-white" />
        </div>
        <span className="text-base font-bold text-gray-900">GearTrack</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {navItems.filter(({ minRole }) => {
            if (minRole === 'admin') return appUser?.role === 'admin';
            if (minRole === 'manager') return appUser?.role === 'admin' || appUser?.role === 'manager';
            return true;
          }).map(({ to, label, icon: Icon, exact }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={exact}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`
                }
              >
                <Icon size={17} />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* User footer */}
      <div className="border-t border-gray-100 px-3 py-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">
            {appUser?.displayName?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">{appUser?.displayName}</p>
            <p className="truncate text-xs text-gray-500 capitalize">{appUser?.role}</p>
          </div>
          <button
            onClick={onLogout}
            className="text-gray-400 hover:text-red-500 transition-colors"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
