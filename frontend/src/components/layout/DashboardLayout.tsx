import { useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard,
  MapPin,
  ShieldAlert,
  Navigation,
  Megaphone,
  Users,
  UserCircle2,
  Building2,
  ClipboardCheck,
  BarChart3,
  LogOut,
  Menu,
  X,
  PhoneCall,
} from 'lucide-react';

import { BrandLogo } from '@/components/ui/BrandLogo';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import type { UserRole } from '@/types';

interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}

const navByRole: Record<UserRole, NavItem[]> = {
  WOMAN: [
    { label: 'Overview', to: '/app', icon: LayoutDashboard, end: true },
    { label: 'Nearby SafePlaces', to: '/app/map', icon: MapPin },
    { label: 'Assistance Loop', to: '/app/requests', icon: ShieldAlert },
    { label: 'Journey Watch', to: '/app/journey', icon: Navigation },
    { label: 'Safety Reports', to: '/app/reports', icon: Megaphone },
    { label: 'Companions', to: '/app/companions', icon: Users },
    { label: 'Profile & Privacy', to: '/profile', icon: UserCircle2 },
  ],
  PARTNER: [
    { label: 'Partner Console', to: '/partner', icon: LayoutDashboard, end: true },
    { label: 'My Establishment', to: '/partner/establishment', icon: Building2 },
    { label: 'Profile', to: '/profile', icon: UserCircle2 },
  ],
  ADMIN: [
    { label: 'Admin Overview', to: '/admin', icon: BarChart3, end: true },
    { label: 'Partner Approvals', to: '/admin/partners', icon: ClipboardCheck },
    { label: 'Reports & AI Insights', to: '/admin/reports', icon: Megaphone },
    { label: 'Companions', to: '/admin/companions', icon: Users },
    { label: 'Profile', to: '/profile', icon: UserCircle2 },
  ],
};

const roleBadgeTone: Record<UserRole, 'mint' | 'violet' | 'pink'> = {
  WOMAN: 'mint',
  PARTNER: 'violet',
  ADMIN: 'pink',
};

export function DashboardLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { user, logout } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) return null;
  const items = navByRole[user.role];

  const handleLogout = async () => {
    await logout();
    pushToast({ tone: 'info', title: 'Signed out safely' });
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-warm-white text-charcoal">
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-mint focus:px-4 focus:py-2 focus:text-xs focus:font-bold focus:text-charcoal"
      >
        Skip to main content
      </a>
      {/* Floating Liquid Glass Top Bar */}
      <header className="sticky top-3 z-30 mx-auto max-w-7xl px-3 sm:px-6">
        <div className="surface-glass flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              aria-label="Toggle dashboard menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border-soft bg-white/80 text-charcoal lg:hidden"
            >
              {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <Link to="/">
              <BrandLogo compact />
            </Link>
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-bold text-charcoal">
                  SafeStop 360
                </span>
                <Badge tone={roleBadgeTone[user.role]}>{user.role}</Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Zero-delay official emergency links */}
            <a
              href="tel:112"
              className="inline-flex items-center gap-1 rounded-full border border-[var(--color-error)] bg-[var(--color-error-soft)] px-3 py-1.5 text-xs font-bold text-[var(--color-error-deep)]"
            >
              <PhoneCall className="h-3 w-3" aria-hidden="true" />
              112
            </a>
            <a
              href="tel:181"
              className="hidden items-center gap-1 rounded-full border border-[var(--color-pink)]/50 bg-[var(--color-pink-soft)] px-3 py-1.5 text-xs font-bold text-[#9b2c63] sm:inline-flex"
            >
              <PhoneCall className="h-3 w-3" aria-hidden="true" />
              181
            </a>
            <Button size="sm" variant="ghost" type="button" onClick={handleLogout}>
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-3 pb-16 pt-6 sm:px-6 lg:grid-cols-[248px_1fr]">
        {/* Desktop Matte Sidebar */}
        <aside className="hidden lg:block">
          <div className="surface-matte sticky top-24 space-y-5 p-4">
            <div className="rounded-2xl bg-warm-white p-3.5">
              <p className="truncate font-display text-sm font-bold text-charcoal">
                {user.full_name}
              </p>
              <p className="truncate text-xs text-charcoal-muted">{user.email}</p>
            </div>
            <nav aria-label="Dashboard sections" className="space-y-1">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-mint-soft text-mint-deep font-semibold shadow-sm'
                          : 'text-charcoal-muted hover:bg-warm-white hover:text-charcoal'
                      }`
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Mobile Drawer Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.aside
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="surface-glass p-4 lg:hidden"
            >
              <nav aria-label="Mobile dashboard sections" className="grid gap-1 sm:grid-cols-2">
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium ${
                          isActive
                            ? 'bg-mint-soft text-mint-deep font-semibold'
                            : 'text-charcoal hover:bg-white/70'
                        }`
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {item.label}
                    </NavLink>
                  );
                })}
              </nav>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Workspace Content */}
        <motion.main
          id="dashboard-main"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="min-w-0 space-y-6"
        >
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-2xl font-extrabold text-charcoal sm:text-3xl">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-charcoal-muted">{subtitle}</p>
            )}
          </div>
          {children}
        </motion.main>
      </div>
    </div>
  );
}
