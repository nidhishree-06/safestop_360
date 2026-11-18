import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Sparkles } from 'lucide-react';

import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { EmergencyBanner } from '@/components/ui/EmergencyBanner';
import { getDashboardPath, useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/services/api';

const demoAccounts = [
  {
    label: 'Woman Demo',
    email: 'ananya@demo.safestop360.local',
    password: 'DemoWoman@2026!',
  },
  {
    label: 'Partner Demo',
    email: 'partner@demo.safestop360.local',
    password: 'DemoPartner@2026!',
  },
  {
    label: 'Admin Demo',
    email: 'admin@demo.safestop360.local',
    password: 'DemoAdmin@2026!',
  },
];

export function LoginPage() {
  const { login } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Please enter both your email address and password.');
      return;
    }
    setSubmitting(true);
    try {
      const loggedIn = await login(email.trim(), password);
      pushToast({
        tone: 'success',
        title: `Welcome back, ${loggedIn.full_name.split(' ')[0] || 'there'}`,
        description: `Signed in as ${loggedIn.role}.`,
      });
      const next = searchParams.get('next');
      if (next && next.startsWith('/') && !next.startsWith('//')) {
        navigate(next, { replace: true });
      } else {
        navigate(getDashboardPath(loggedIn.role), { replace: true });
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Unable to reach the SafeStop server. Please verify the backend is running.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-warm-white text-charcoal">
      <Navbar />

      <main className="mx-auto max-w-xl px-4 pb-12 pt-10 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          <Card surface="matte" className="p-6 sm:p-9">
            <div className="space-y-2">
              <Badge tone="mint">Secure Sign In</Badge>
              <h1 className="font-display text-2xl font-extrabold text-charcoal sm:text-3xl">
                Sign in to SafeStop 360
              </h1>
              <p className="text-sm text-charcoal-muted">
                Access your dashboard, Journey Watch, partner console, or admin review
                workspace.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="mt-5 rounded-2xl border border-[var(--color-error)] bg-[var(--color-error-soft)] px-4 py-3 text-xs font-medium text-[var(--color-error-deep)]"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
              <Input
                label="Email Address"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="h-4 w-4" />}
                required
              />

              <Input
                label="Password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="h-4 w-4" />}
                rightSlot={
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="p-1 text-charcoal-muted hover:text-charcoal"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
                required
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="mt-2 w-full"
                disabled={submitting}
              >
                {submitting ? 'Signing in...' : 'Sign In'}
                {!submitting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
              </Button>
            </form>

            {/* Clearly labelled Demo Quick-Fill for Local Ideathon Demonstration */}
            <div className="mt-7 rounded-2xl border border-border-soft bg-warm-white p-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-charcoal">
                <Sparkles className="h-3.5 w-3.5 text-mint-deep" aria-hidden="true" />
                Local Development Demo Accounts
              </div>
              <p className="mt-1 text-[11px] text-charcoal-muted">
                Click a role below to prefill seeded local demo credentials:
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {demoAccounts.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => {
                      setEmail(acc.email);
                      setPassword(acc.password);
                      setError(null);
                    }}
                    className="neu-chip px-3 py-1.5 text-xs font-semibold hover:border-mint-dark"
                  >
                    {acc.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-6 text-center text-sm text-charcoal-muted">
              New to SafeStop 360?{' '}
              <Link to="/register" className="font-semibold text-mint-deep hover:underline">
                Create an account
              </Link>
            </p>
          </Card>

          <EmergencyBanner />
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
