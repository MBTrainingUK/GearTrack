import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Layers,
  // Uncomment alongside the two nav entries below to restore Reservations and
  // Checkouts to the sidebar.
  // CalendarRange,
  // ArrowLeftRight,
  PackageCheck,
  CheckCircle2,
  History,
  LogOut,
  Menu,
  Shield,
  BarChart2,
  Activity,
  Building2,
  ShoppingBasket,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/useAuth';
import type { AppUser } from '../types';
import AppLogo from './AppLogo';
import BasketDrawer from './BasketDrawer';
import ThemeToggle from './ThemeToggle';
import { useBasket } from '../store/basket';
import { usePendingApprovals } from '../store/approvals';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true, minRole: 'user' },
  { to: '/items', label: 'Items', icon: Package, minRole: 'user' },
  { to: '/kits', label: 'Kits', icon: Layers, minRole: 'user' },
  // My Gear is the counterpart to the basket: the basket is gear going out,
  // My Gear is gear you already have. It carries the two actions that used to
  // live only on the Checkouts and Reservations screens — returning kit and
  // calling off your own booking.
  { to: '/my-gear', label: 'My Gear', icon: PackageCheck, minRole: 'user' },
  { to: '/approvals', label: 'Approvals', icon: CheckCircle2, minRole: 'manager', badge: 'approvals' as const },
  // TEMPORARY (trial, 20 Sep 2026): Reservations and Checkouts are out of the
  // sidebar entirely, now that My Gear and Approvals carry what most people
  // needed from them. Commented out rather than deleted — Jason may want them
  // back. Both routes still exist and are reached from the Dashboard links and
  // My History.
  //
  // What has no signposted home while these are hidden:
  //   - Checking in gear on someone ELSE'S behalf. CheckoutsList gates that on
  //     role !== 'user' and it is scoped to the whole org, so My Gear (which is
  //     userId == me) cannot cover it. This is the one to watch.
  //   - The reservations calendar and its Monday.com filming-dates overlay.
  //
  // { to: '/reservations', label: 'Reservations', icon: CalendarRange, minRole: 'manager' },
  // { to: '/checkouts', label: 'Checkouts', icon: ArrowLeftRight, minRole: 'manager' },
  { to: '/history', label: 'My History', icon: History, minRole: 'user' },
  { to: '/activity', label: 'Activity', icon: Activity, minRole: 'manager' },
  { to: '/reports', label: 'Reports', icon: BarChart2, minRole: 'admin' },
  { to: '/admin', label: 'Admin', icon: Shield, minRole: 'admin' },
  { to: '/organizations', label: 'Organizations', icon: Building2, minRole: 'platformAdmin' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { appUser, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [basketOpen, setBasketOpen] = useState(false);
  const { count: basketCount } = useBasket();
  const { count: approvalsCount } = usePendingApprovals();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-canvas">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 flex-shrink-0 border-r border-line bg-surface lg:flex lg:flex-col">
        <SidebarContent
          appUser={appUser}
          basketCount={basketCount}
          approvalsCount={approvalsCount}
          onOpenBasket={() => setBasketOpen(true)}
          onNavigate={() => setMobileOpen(false)}
          onLogout={handleLogout}
        />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/30"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-50 w-56 bg-surface shadow-xl">
            <SidebarContent
              appUser={appUser}
              basketCount={basketCount}
              approvalsCount={approvalsCount}
              onOpenBasket={() => { setBasketOpen(true); setMobileOpen(false); }}
              onNavigate={() => setMobileOpen(false)}
              onLogout={handleLogout}
            />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="flex h-14 items-center gap-3 border-b border-line bg-surface px-4 lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-ink-muted hover:text-ink"
          >
            <Menu size={20} />
          </button>
          <AppLogo size={28} />
          <span className="font-bold text-ink">GearTrack</span>
          <button
            onClick={() => setBasketOpen(true)}
            className="relative ml-auto text-ink-muted hover:text-ink"
            title="Basket"
          >
            <ShoppingBasket size={20} />
            {basketCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white">
                {basketCount}
              </span>
            )}
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-5">{children}</main>
      </div>

      <BasketDrawer open={basketOpen} onClose={() => setBasketOpen(false)} />
    </div>
  );
}

function SidebarContent({
  appUser,
  basketCount,
  approvalsCount,
  onOpenBasket,
  onNavigate,
  onLogout,
}: {
  appUser: AppUser | null;
  basketCount: number;
  approvalsCount: number;
  onOpenBasket: () => void;
  onNavigate: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-line-subtle px-5">
        <AppLogo size={32} />
        <span className="text-base font-bold text-ink">GearTrack</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {navItems.filter(({ minRole }) => {
            if (minRole === 'platformAdmin') return appUser?.isPlatformAdmin === true;
            if (minRole === 'admin') return appUser?.role === 'admin';
            if (minRole === 'manager') return appUser?.role === 'admin' || appUser?.role === 'manager';
            return true;
          }).map(({ to, label, icon: Icon, exact, badge }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={exact}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300'
                      : 'text-ink-body hover:bg-surface-hover hover:text-ink'
                  }`
                }
              >
                <Icon size={17} />
                {label}
                {badge === 'approvals' && approvalsCount > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-white">
                    {approvalsCount}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
          {/* Not a route — the basket is a drawer, so it opens over whatever
              screen the user is already on. */}
          <li>
            <button
              onClick={onOpenBasket}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-body transition-colors hover:bg-surface-hover hover:text-ink"
            >
              <ShoppingBasket size={17} />
              Basket
              {basketCount > 0 && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-semibold text-white">
                  {basketCount}
                </span>
              )}
            </button>
          </li>
        </ul>
      </nav>

      {/* User footer */}
      <div className="border-t border-line-subtle px-3 py-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 text-sm font-semibold">
            {appUser?.displayName?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{appUser?.displayName}</p>
            <p className="truncate text-xs text-ink-muted">
              {appUser?.role === 'manager' ? 'Team Member' : appUser?.role === 'admin' ? 'Admin' : 'User'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <ThemeToggle />
            <button
              onClick={onLogout}
              className="text-ink-faint hover:text-red-500 dark:hover:text-red-400 transition-colors"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
