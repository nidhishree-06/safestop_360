import { useState, type FormEvent } from 'react';
import { User, Phone, MapPin, Shield, Lock, Save, Trash2 } from 'lucide-react';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Switch';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { ApiError, changePassword, deleteMyLocationData } from '@/services/api';

export function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const { pushToast } = useToast();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.profile?.phone || '');
  const [city, setCity] = useState(user?.profile?.city || 'Mysuru');
  const [emergencyNote, setEmergencyNote] = useState(user?.profile?.emergency_note || '');
  const [locationDefault, setLocationDefault] = useState(
    Boolean(user?.profile?.location_sharing_default),
  );
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingLocation, setDeletingLocation] = useState(false);

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

  const handleDeleteLocationData = async () => {
    setDeletingLocation(true);
    try {
      const res = await deleteMyLocationData();
      sessionStorage.removeItem('safestop_last_location');
      setDeleteModalOpen(false);
      pushToast({
        tone: 'success',
        title: 'Location data deleted',
        description: `${res.detail} (${res.deleted_pings} ping(s) purged).`,
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Failed to delete location data',
        description: err instanceof ApiError ? err.message : 'Please try again.',
      });
    } finally {
      setDeletingLocation(false);
    }
  };

  return (
    <DashboardLayout
      title="Profile & Privacy Settings"
      subtitle="Manage your personal details, opt-in GPS defaults, location data deletion, and security."
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

            <div className="rounded-2xl border border-border-soft bg-warm-white p-3.5">
              <Switch
                checked={locationDefault}
                onChange={setLocationDefault}
                label="Pre-select opt-in location sharing for new journeys"
                description="Location is never tracked silently and can always be turned off per request or journey."
              />
            </div>

            <Button type="submit" variant="primary" disabled={savingProfile}>
              <Save className="h-4 w-4" aria-hidden="true" />
              {savingProfile ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card surface="matte" className="p-6">
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

          <Card surface="matte" className="border-[var(--color-error)]/40 p-6">
            <h2 className="font-display text-base font-bold text-charcoal">
              Location Privacy Control
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-charcoal-muted">
              SafeStop 360 never exposes your live location publicly and deletes request/journey
              pings automatically when sessions end. You can also erase all stored coordinates
              immediately.
            </p>
            <div className="mt-4">
              <Button
                type="button"
                variant="danger"
                onClick={() => setDeleteModalOpen(true)}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete my location data
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete all stored location data?"
        subtitle="This immediately purges all LocationPing records and saved coordinates on your journeys and help requests."
      >
        <p className="text-sm text-charcoal-muted">
          Any active live location sharing will be switched off. Your account, trusted contacts,
          and request summaries remain intact.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteModalOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={deletingLocation}
            onClick={handleDeleteLocationData}
          >
            {deletingLocation ? 'Deleting...' : 'Yes, delete my location data'}
          </Button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
