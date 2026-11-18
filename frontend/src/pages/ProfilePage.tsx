import { useState, type FormEvent } from 'react';
import { User, Phone, MapPin, Shield, Lock, Save } from 'lucide-react';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { ApiError, changePassword } from '@/services/api';

export function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const { pushToast } = useToast();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.profile?.phone || '');
  const [city, setCity] = useState(user?.profile?.city || 'Bengaluru');
  const [emergencyNote, setEmergencyNote] = useState(user?.profile?.emergency_note || '');
  const [locationDefault, setLocationDefault] = useState(
    Boolean(user?.profile?.location_sharing_default)
  );
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const handleProfileSave = async (e: FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateProfile({
        full_name: fullName.trim(),
        phone: phone.trim(),
        city: city.trim(),
        emergency_note: emergencyNote.trim(),
        location_sharing_default: locationDefault,
      });
      pushToast({
        tone: 'success',
        title: 'Profile updated',
        description: 'Your account and privacy settings have been saved.',
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Update failed',
        description: err instanceof ApiError ? err.message : 'Unable to save profile.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) {
      pushToast({ tone: 'error', title: 'New passwords do not match' });
      return;
    }
    setSavingPw(true);
    try {
      await changePassword(currentPw, newPw);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      pushToast({
        tone: 'success',
        title: 'Password updated',
        description: 'Use your new password the next time you sign in.',
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Could not change password',
        description: err instanceof ApiError ? err.message : 'Please check your input.',
      });
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <DashboardLayout
      title="Profile & Privacy Settings"
      subtitle="Manage your personal information, opt-in privacy defaults, and account security."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Card surface="matte" className="p-6">
          <h2 className="font-display text-lg font-bold text-charcoal">
            Personal Details &amp; Privacy
          </h2>
          <form onSubmit={handleProfileSave} className="mt-5 space-y-4">
            <Input
              label="Full Name"
              name="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              leftIcon={<User className="h-4 w-4" />}
              required
            />
            <Input
              label="Phone Number"
              name="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              leftIcon={<Phone className="h-4 w-4" />}
            />
            <Input
              label="City"
              name="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              leftIcon={<MapPin className="h-4 w-4" />}
            />
            <div className="space-y-1.5">
              <label
                htmlFor="emergency_note"
                className="block text-xs font-semibold tracking-wide text-charcoal"
              >
                Optional Assistance Note
              </label>
              <textarea
                id="emergency_note"
                rows={3}
                maxLength={280}
                value={emergencyNote}
                onChange={(e) => setEmergencyNote(e.target.value)}
                placeholder="Shared only when you explicitly initiate an assistance request."
                className="neu-input-pill w-full px-3.5 py-2.5 text-sm text-charcoal placeholder:text-charcoal-muted/70 focus:outline-none"
              />
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border-soft bg-warm-white p-3.5">
              <input
                type="checkbox"
                checked={locationDefault}
                onChange={(e) => setLocationDefault(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[#68bfa3]"
              />
              <span className="text-xs leading-relaxed text-charcoal-muted">
                <strong className="block text-charcoal">
                  Pre-select opt-in location sharing for new Journey Watch sessions
                </strong>
                Location is never tracked silently and can always be toggled off per
                journey.
              </span>
            </label>

            <Button type="submit" variant="primary" disabled={savingProfile}>
              <Save className="h-4 w-4" aria-hidden="true" />
              {savingProfile ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </Card>

        <Card surface="matte" className="h-fit p-6">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-mint-deep" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold text-charcoal">
              Account Security
            </h2>
          </div>
          <p className="mt-1 text-xs text-charcoal-muted">
            Signed in as <strong>{user?.email}</strong> ({user?.role})
          </p>

          <form onSubmit={handlePasswordSubmit} className="mt-5 space-y-4">
            <Input
              label="Current Password"
              name="current_password"
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              leftIcon={<Lock className="h-4 w-4" />}
              required
            />
            <Input
              label="New Password"
              name="new_password"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              leftIcon={<Lock className="h-4 w-4" />}
              hint="Minimum 8 characters, avoiding common passwords."
              required
            />
            <Input
              label="Confirm New Password"
              name="confirm_new_password"
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              leftIcon={<Lock className="h-4 w-4" />}
              required
            />
            <Button type="submit" variant="secondary" disabled={savingPw}>
              {savingPw ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
}
