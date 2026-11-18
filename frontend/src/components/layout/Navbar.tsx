import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X, LayoutDashboard, LogOut, UserCircle2 } from 'lucide-react';

import { BrandLogo } from '@/components/ui/BrandLogo';
import { Button } from '@/components/ui/Button';
import { getDashboardPath, useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'How It Works', to: '/#how-it-works' },
  { label: 'Find Assistance', to: '/find-help' },
  { label: 'Safety Resources', to: '/resources' },
  { label: 'About', to: '/#about' },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const { pushToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    setMobileOpen(false);
    pushToast({
      tone: 'info',
      title: 'Signed out',
      description: 'Your SafeStop 360 session has been closed safely.',
    });
    navigate('/');
  };

  const handleAnchorClick = (to: string) => {
    setMobileOpen(false);
    if (to.startsWith('/#') && location.pathname === '/') {
      const targetId = to.slice(2);
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <header className="sticky top-3 z-40 mx-auto w-full max-w-7xl px-3 sm:top-4 sm:px-6">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-mint focus:px-4 focus:py-2 focus:text-xs focus:font-bold focus:text-charcoal"
      >
        Skip to content
      </a>
      <nav
        aria-label="Primary navigation"
        className="surface-glass flex items-center justify-between px-4 py-2.5 sm:px-6 sm:py-3"
      >
        <Link to="/" onClick={() => setMobileOpen(false)} aria-label="SafeStop 360 Home">
          <BrandLogo />
        </Link>

        {/* Desktop Links */}
        <ul className="hidden items-center gap-1 lg:flex">
          {navLinks.map((item) => (
            <li key={item.label}>
              {item.to.startsWith('/#') ? (
                <a
                  href={item.to}
                  onClick={() => handleAnchorClick(item.to)}
                  className="rounded-full px-3.5 py-2 text-sm font-medium text-charcoal-muted transition-colors hover:bg-white/70 hover:text-charcoal"
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  to={item.to}
                  className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                    location.pathname === item.to
                      ? 'bg-mint-soft text-mint-deep'
                      : 'text-charcoal-muted hover:bg-white/70 hover:text-charcoal'
                  }`}
                >
                  {item.label}
                </Link>
              )}
            </li>
          ))}
        </ul>

        {/* Desktop Auth Actions */}
        <div className="hidden items-center gap-2.5 lg:flex">
          {isAuthenticated && user ? (
            <>
              <Link to={getDashboardPath(user.role)}>
                <Button size="sm" variant="primary" type="button">
                  <LayoutDashboard className="h-3.5 w-3.5" aria-hidden="true" />
                  Dashboard
                </Button>
              </Link>
              <Link to="/profile" aria-label="Profile settings">
                <Button size="sm" variant="secondary" type="button">
                  <UserCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {user.full_name.split(' ')[0] || 'Profile'}
                </Button>
              </Link>
              <Button size="sm" variant="ghost" type="button" onClick={handleLogout}>
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button size="sm" variant="ghost" type="button">
                  Login
                </Button>
              </Link>
              <Link to="/register">
                <Button size="sm" variant="primary" type="button">
                  Get Started
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border-soft bg-white/80 text-charcoal lg:hidden"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
            className="surface-glass mt-2 p-4 lg:hidden"
          >
            <ul className="space-y-1">
              {navLinks.map((item) => (
                <li key={item.label}>
                  {item.to.startsWith('/#') ? (
                    <a
                      href={item.to}
                      onClick={() => handleAnchorClick(item.to)}
                      className="block rounded-xl px-3.5 py-2.5 text-sm font-medium text-charcoal hover:bg-white/70"
                    >
                      {item.label}
                    </a>
                  ) : (
                    <Link
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className="block rounded-xl px-3.5 py-2.5 text-sm font-medium text-charcoal hover:bg-white/70"
                    >
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-col gap-2 border-t border-border-soft pt-4">
              {isAuthenticated && user ? (
                <>
                  <Link
                    to={getDashboardPath(user.role)}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Button size="md" variant="primary" className="w-full" type="button">
                      <LayoutDashboard className="h-4 w-4" />
                      Go to Dashboard
                    </Button>
                  </Link>
                  <div className="grid grid-cols-2 gap-2">
                    <Link to="/profile" onClick={() => setMobileOpen(false)}>
                      <Button size="sm" variant="secondary" className="w-full" type="button">
                        Profile
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full"
                      type="button"
                      onClick={handleLogout}
                    >
                      Logout
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Link to="/register" onClick={() => setMobileOpen(false)}>
                    <Button size="md" variant="primary" className="w-full" type="button">
                      Get Started
                    </Button>
                  </Link>
                  <Link to="/login" onClick={() => setMobileOpen(false)}>
                    <Button size="md" variant="secondary" className="w-full" type="button">
                      Login
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
