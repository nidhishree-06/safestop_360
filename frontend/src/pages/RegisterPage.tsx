import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  User,
  Mail,
  Lock,
  Phone,
  MapPin,
  Building2,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
} from 'lucide-react';

import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { getDashboardPath, useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/services/api';

export function RegisterPage() {
  const { register } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialRole =
    searchParams.get('role')?.toUpperCase() === 'PARTNER' ? 'PARTNER' : 'WOMAN';

  const [role, setRole] = useState<'WOMAN' | 'PARTNER'>(initialRole);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Mysuru');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasMinLen = password.length >= 8;
  const hasMixed = /[A-Za-z]/.test(password) && /\d/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (fullName.trim().length < 2) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!hasMinLen) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await register({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        role,
        phone: phone.trim(),
        city: city.trim() || 'Mysuru',
      });
      pushToast({
        tone: 'success',
        title: 'Account created',
        description:
          created.role === 'PARTNER'
            ? 'Next: submit your establishment details for administrator approval.'
            : 'Welcome to SafeStop 360. Your personal dashboard is ready.',
      });
      navigate(getDashboardPath(created.role), { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Registration failed. Please check your connection and try again.'
      );
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
        >
          <Card surface="matte" className="p-6 sm:p-9">
            <div className="space-y-2">
              <Badge tone="mint">Create Account</Badge>
              <h1 className="font-display text-2xl font-extrabold text-charcoal sm:text-3xl">
                Join SafeStop 360
              </h1>
              <p className="text-sm text-charcoal-muted">
                Choose your account type. Partner establishments require administrator
                verification before appearing on the SafePlaces map.
              </p>
            </div>

            {/* Soft Neumorphic Role Selector */}
            <div className="neu-tab-track mt-6 grid grid-cols-2 gap-1.5" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={role === 'WOMAN'}
                onClick={() => setRole('WOMAN')}
                className={`flex items-center justify-center gap-2 rounded-full px-3 py-2.5 text-xs font-semibold transition-all sm:text-sm ${
                  role === 'WOMAN'
                    ? 'bg-mint text-charcoal shadow-sm'
                    : 'text-charcoal-muted hover:text-charcoal'
                }`}
              >
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Woman User
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={role === 'PARTNER'}
                onClick={() => setRole('PARTNER')}
                className={`flex items-center justify-center gap-2 rounded-full px-3 py-2.5 text-xs font-semibold transition-all sm:text-sm ${
                  role === 'PARTNER'
                    ? 'bg-mint text-charcoal shadow-sm'
                    : 'text-charcoal-muted hover:text-charcoal'
                }`}
              >
                <Building2 className="h-4 w-4" aria-hidden="true" />
                SafeStop Partner
              </button>
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
                label={role === 'PARTNER' ? 'Coordinator Full Name' : 'Full Name'}
                name="full_name"
                placeholder={role === 'PARTNER' ? 'e.g. Sunita Rao' : 'e.g. Ananya Rao'}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                leftIcon={<User className="h-4 w-4" />}
                required
              />

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

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Phone Number (Optional)"
                  name="phone"
                  type="tel"
                  placeholder="+91-98765-43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  leftIcon={<Phone className="h-4 w-4" />}
                />
                <Input
                  label="City"
                  name="city"
                  placeholder="Mysuru"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  leftIcon={<MapPin className="h-4 w-4" />}
                />
              </div>

              <Input
                label="Password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Create a strong password"
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

              <Input
                label="Confirm Password"
                name="confirm_password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                leftIcon={<Lock className="h-4 w-4" />}
                required
              />

              <div className="flex flex-wrap gap-3 rounded-2xl bg-warm-white px-3.5 py-2.5 text-[11px]">
                <span
                  className={`inline-flex items-center gap-1 ${
                    hasMinLen ? 'font-semibold text-mint-deep' : 'text-charcoal-muted'
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  8+ characters
                </span>
                <span
                  className={`inline-flex items-center gap-1 ${
                    hasMixed ? 'font-semibold text-mint-deep' : 'text-charcoal-muted'
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Letters &amp; numbers
                </span>
                <span
                  className={`inline-flex items-center gap-1 ${
                    passwordsMatch ? 'font-semibold text-mint-deep' : 'text-charcoal-muted'
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Passwords match
                </span>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="mt-2 w-full"
                disabled={submitting}
              >
                {submitting
                  ? 'Creating account...'
                  : role === 'PARTNER'
                    ? 'Create Partner Account'
                    : 'Create SafeStop Account'}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-charcoal-muted">
              Already registered?{' '}
              <Link to="/login" className="font-semibold text-mint-deep hover:underline">
                Sign in
              </Link>
            </p>
          </Card>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
