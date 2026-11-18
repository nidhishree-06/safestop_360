import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Navigation,
  Clock,
  CheckCircle2,
  AlertTriangle,
  EyeOff,
  Users,
  Plus,
  Trash2,
  Pencil,
  ShieldCheck,
  MapPin,
} from 'lucide-react';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmergencyBanner } from '@/components/ui/EmergencyBanner';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  ApiError,
  checkInJourney,
  completeJourney,
  createTrustedContact,
  deleteTrustedContact,
  fetchJourneys,
  fetchTrustedContacts,
  startJourney,
  stopJourneySharing,
  updateTrustedContact,
} from '@/services/api';
import type { JourneyItem, TrustedContactItem } from '@/types';

export function JourneyWatchPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();

  const [journeys, setJourneys] = useState<JourneyItem[]>([]);
  const [contacts, setContacts] = useState<TrustedContactItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Start journey form
  const [originLabel, setOriginLabel] = useState('');
  const [destinationLabel, setDestinationLabel] = useState('');
  const [etaMinutes, setEtaMinutes] = useState('35');
  const [intervalMinutes, setIntervalMinutes] = useState('15');
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [optInLocation, setOptInLocation] = useState(
    Boolean(user?.profile?.location_sharing_default)
  );
  const [checkinNote, setCheckinNote] = useState('');

  // Contact modal state
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<TrustedContactItem | null>(null);
  const [cName, setCName] = useState('');
  const [cRel, setCRel] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cPrimary, setCPrimary] = useState(false);
  const [cNotifyStart, setCNotifyStart] = useState(true);
  const [cNotifyMissed, setCNotifyMissed] = useState(true);
  const [cNotifyArrival, setCNotifyArrival] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [jRes, cRes] = await Promise.all([
        fetchJourneys(),
        fetchTrustedContacts(),
      ]);
      setJourneys(jRes.results);
      setContacts(cRes.results);
      setSelectedContactIds((prev) =>
        prev.length > 0 ? prev : cRes.results.slice(0, 2).map((c) => c.id)
      );
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Unable to load Journey Watch',
        description: err instanceof ApiError ? err.message : 'Check backend connection.',
      });
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const activeJourney = useMemo(
    () => journeys.find((j) => j.status === 'ACTIVE' || j.status === 'OVERDUE') || null,
    [journeys]
  );

  // Refresh active journey periodically to catch overdue check-in reminders
  useEffect(() => {
    if (!activeJourney) return;
    const timer = window.setInterval(() => {
      fetchJourneys()
        .then((res) => setJourneys(res.results))
        .catch(() => {});
    }, 15000);
    return () => window.clearInterval(timer);
  }, [activeJourney]);

  const handleStartJourney = async (e: FormEvent) => {
    e.preventDefault();
    if (!destinationLabel.trim()) return;
    setBusy(true);
    try {
      const etaDate = new Date(Date.now() + Number(etaMinutes || 30) * 60000);
      const created = await startJourney({
        origin_label: originLabel.trim(),
        destination_label: destinationLabel.trim(),
        expected_arrival_at: etaDate.toISOString(),
        checkin_interval_minutes: Number(intervalMinutes || 15),
        location_sharing_enabled: optInLocation,
        trusted_contact_ids: selectedContactIds,
      });
      setJourneys((prev) => [created, ...prev]);
      setOriginLabel('');
      setDestinationLabel('');
      pushToast({
        tone: 'success',
        title: 'Journey Watch started',
        description: `Private check-in timer active for ${created.destination_label}.`,
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Could not start journey',
        description: err instanceof ApiError ? err.message : 'Please check your input.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCheckIn = async (statusChoice: 'SAFE' | 'DELAYED') => {
    if (!activeJourney) return;
    setBusy(true);
    try {
      const updated = await checkInJourney(activeJourney.id, {
        status: statusChoice,
        note: checkinNote.trim(),
      });
      setJourneys((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
      setCheckinNote('');
      pushToast({
        tone: 'success',
        title: statusChoice === 'SAFE' ? 'Checked in safe' : 'Delay noted',
        description: 'Your private check-in timer has been refreshed.',
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Check-in failed',
        description: err instanceof ApiError ? err.message : 'Try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleComplete = async () => {
    if (!activeJourney) return;
    setBusy(true);
    try {
      const updated = await completeJourney(activeJourney.id);
      setJourneys((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
      pushToast({
        tone: 'success',
        title: 'Safe arrival confirmed',
        description: 'Journey Watch has ended and location sharing is turned off.',
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Could not complete journey',
        description: err instanceof ApiError ? err.message : 'Try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleStopSharing = async (endJourney: boolean) => {
    if (!activeJourney) return;
    setBusy(true);
    try {
      const updated = await stopJourneySharing(activeJourney.id, endJourney);
      setJourneys((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
      pushToast({
        tone: 'info',
        title: endJourney ? 'Journey ended & sharing stopped' : 'Location sharing stopped',
        description: 'Saved coordinates were cleared immediately.',
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Action failed',
        description: err instanceof ApiError ? err.message : 'Try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  const openContactModal = (contact: TrustedContactItem | null) => {
    setEditingContact(contact);
    setCName(contact?.name || '');
    setCRel(contact?.relationship || '');
    setCPhone(contact?.phone || '');
    setCEmail(contact?.email || '');
    setCPrimary(Boolean(contact?.is_primary));
    setCNotifyStart(contact ? contact.notify_on_journey_start : true);
    setCNotifyMissed(contact ? contact.notify_on_missed_checkin : true);
    setCNotifyArrival(contact ? contact.notify_on_arrival : true);
    setContactModalOpen(true);
  };

  const handleSaveContact = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const payload = {
      name: cName.trim(),
      relationship: cRel.trim(),
      phone: cPhone.trim(),
      email: cEmail.trim(),
      is_primary: cPrimary,
      notify_on_journey_start: cNotifyStart,
      notify_on_missed_checkin: cNotifyMissed,
      notify_on_arrival: cNotifyArrival,
    };
    try {
      if (editingContact) {
        const updated = await updateTrustedContact(editingContact.id, payload);
        setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        pushToast({ tone: 'success', title: 'Trusted contact updated' });
      } else {
        const created = await createTrustedContact(payload);
        setContacts((prev) => [created, ...prev]);
        setSelectedContactIds((prev) => [...prev, created.id]);
        pushToast({ tone: 'success', title: 'Trusted contact added' });
      }
      setContactModalOpen(false);
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Could not save contact',
        description: err instanceof ApiError ? err.message : 'Check fields.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteContact = async (id: string) => {
    try {
      await deleteTrustedContact(id);
      setContacts((prev) => prev.filter((c) => c.id !== id));
      setSelectedContactIds((prev) => prev.filter((cid) => cid !== id));
      pushToast({ tone: 'info', title: 'Contact removed' });
    } catch {
      pushToast({ tone: 'error', title: 'Could not delete contact' });
    }
  };

  const toggleContactSelection = (id: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <DashboardLayout
      title="Journey Watch & Trusted Contacts"
      subtitle="Private, opt-in travel check-ins with the people you trust. Your journey details are never shown on public maps."
    >
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Active Journey OR Start New Journey */}
        <div className="space-y-6 lg:col-span-7">
          {loading ? (
            <div className="surface-matte h-56 animate-pulse p-6" />
          ) : activeJourney ? (
            <Card surface="glass-3d" className="space-y-5 p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge
                    tone={
                      activeJourney.status === 'OVERDUE' || activeJourney.is_checkin_overdue
                        ? 'warning'
                        : 'mint'
                    }
                  >
                    {activeJourney.status === 'OVERDUE' || activeJourney.is_checkin_overdue
                      ? 'Missed Check-In Reminder'
                      : 'Journey Watch Active'}
                  </Badge>
                  <Badge tone={activeJourney.location_sharing_enabled ? 'blue' : 'neutral'}>
                    {activeJourney.location_sharing_enabled
                      ? 'Opt-In Sharing ON'
                      : 'Location Sharing OFF'}
                  </Badge>
                </div>
                <span className="text-xs font-medium text-charcoal-muted">
                  ETA: {new Date(activeJourney.expected_arrival_at).toLocaleTimeString()}
                </span>
              </div>

              {(activeJourney.status === 'OVERDUE' || activeJourney.is_checkin_overdue) && (
                <div className="flex items-start gap-2.5 rounded-2xl border border-[var(--color-warning)] bg-[var(--color-warning-soft)] p-4 text-xs text-[var(--color-warning-deep)]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <strong>Check-in reminder:</strong> Your scheduled check-in time has
                    passed. Tap <strong>Check In Safe</strong> or{' '}
                    <strong>Confirm Arrival</strong> below.
                  </span>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-muted">
                  Destination
                </p>
                <h2 className="mt-1 font-display text-2xl font-extrabold text-charcoal">
                  {activeJourney.destination_label}
                </h2>
                {activeJourney.origin_label && (
                  <p className="text-xs text-charcoal-muted">
                    From: {activeJourney.origin_label}
                  </p>
                )}
              </div>

              <div className="space-y-2 rounded-2xl bg-white/85 p-4">
                <input
                  type="text"
                  value={checkinNote}
                  onChange={(e) => setCheckinNote(e.target.value)}
                  placeholder="Optional check-in note (e.g., Reached metro station)"
                  className="neu-input-pill w-full px-3.5 py-2 text-xs text-charcoal focus:outline-none"
                />
                <div className="flex flex-wrap gap-2.5 pt-1">
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    disabled={busy}
                    onClick={() => handleCheckIn('SAFE')}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Check In Safe
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    disabled={busy}
                    onClick={() => handleCheckIn('DELAYED')}
                  >
                    <Clock className="h-4 w-4" />
                    Running Late
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    disabled={busy}
                    onClick={handleComplete}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    I Arrived Safely
                  </Button>
                </div>
              </div>

              {/* Visible Instant Privacy Control */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-soft/70 pt-4">
                {activeJourney.location_sharing_enabled && (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    disabled={busy}
                    onClick={() => handleStopSharing(false)}
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                    Stop Location Sharing
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => handleStopSharing(true)}
                >
                  End Journey Early
                </Button>
              </div>

              {/* Check-in Timeline */}
              {activeJourney.checkins.length > 0 && (
                <div className="space-y-2 border-t border-border-soft/70 pt-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-charcoal-muted">
                    Check-In Timeline
                  </p>
                  <ul className="space-y-1.5 text-xs">
                    {activeJourney.checkins.slice(0, 5).map((ci) => (
                      <li
                        key={ci.id}
                        className="flex items-center justify-between rounded-xl bg-white/75 px-3 py-2"
                      >
                        <span className="font-medium text-charcoal">
                          {ci.status_display}
                          {ci.note ? ` — ${ci.note}` : ''}
                        </span>
                        <span className="text-charcoal-muted">
                          {new Date(ci.created_at).toLocaleTimeString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          ) : (
            <Card surface="matte" className="p-6">
              <div className="flex items-center gap-2">
                <Navigation className="h-5 w-5 text-mint-deep" />
                <h2 className="font-display text-lg font-bold text-charcoal">
                  Start Private Journey Watch
                </h2>
              </div>
              <p className="mt-1 text-xs text-charcoal-muted">
                Set your destination, expected arrival time, and choose which trusted
                contacts stay informed.
              </p>

              <form onSubmit={handleStartJourney} className="mt-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Starting Point (Optional)"
                    value={originLabel}
                    onChange={(e) => setOriginLabel(e.target.value)}
                    placeholder="e.g. Indiranagar Metro"
                    leftIcon={<MapPin className="h-4 w-4" />}
                  />
                  <Input
                    label="Destination"
                    value={destinationLabel}
                    onChange={(e) => setDestinationLabel(e.target.value)}
                    placeholder="e.g. Koramangala Home"
                    leftIcon={<Navigation className="h-4 w-4" />}
                    required
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Expected Arrival (minutes from now)"
                    type="number"
                    min={5}
                    max={360}
                    value={etaMinutes}
                    onChange={(e) => setEtaMinutes(e.target.value)}
                    required
                  />
                  <Input
                    label="Check-In Reminder Every (mins)"
                    type="number"
                    min={5}
                    max={180}
                    value={intervalMinutes}
                    onChange={(e) => setIntervalMinutes(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <span className="block text-xs font-semibold text-charcoal">
                    Select Trusted Contacts for This Journey
                  </span>
                  {contacts.length === 0 ? (
                    <p className="text-xs text-charcoal-muted">
                      Add a trusted contact on the right panel to include them here.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {contacts.map((c) => {
                        const selected = selectedContactIds.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggleContactSelection(c.id)}
                            className={`neu-chip px-3.5 py-1.5 text-xs font-semibold ${
                              selected ? 'neu-chip-active' : ''
                            }`}
                          >
                            {c.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl border border-border-soft bg-warm-white p-3.5 text-xs text-charcoal-muted">
                  <input
                    type="checkbox"
                    checked={optInLocation}
                    onChange={(e) => setOptInLocation(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[#68bfa3]"
                  />
                  <span>
                    <strong className="block text-charcoal">
                      Opt-in: Allow check-in location capture for this private journey
                    </strong>
                    You can tap &ldquo;Stop Location Sharing&rdquo; anytime to turn this
                    off immediately. Never shown publicly.
                  </span>
                </label>

                <Button type="submit" variant="primary" size="lg" disabled={busy}>
                  <Navigation className="h-4 w-4" />
                  {busy ? 'Starting...' : 'Start Journey Watch'}
                </Button>
              </form>
            </Card>
          )}

          {/* Past Journey History */}
          <Card surface="matte" className="space-y-3 p-6">
            <h3 className="font-display text-base font-bold text-charcoal">
              Recent Journeys ({journeys.length})
            </h3>
            {journeys.length === 0 ? (
              <p className="text-xs text-charcoal-muted">No journeys recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {journeys.slice(0, 6).map((j) => (
                  <div
                    key={j.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-warm-white px-4 py-3 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-charcoal">{j.destination_label}</p>
                      <p className="text-charcoal-muted">
                        {new Date(j.created_at).toLocaleString()} ·{' '}
                        {j.trusted_contacts.length} contact(s)
                      </p>
                    </div>
                    <Badge
                      tone={
                        j.status === 'COMPLETED'
                          ? 'mint'
                          : j.status === 'ACTIVE'
                            ? 'blue'
                            : j.status === 'OVERDUE'
                              ? 'warning'
                              : 'neutral'
                      }
                    >
                      {j.status_display}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right: Trusted Contacts Manager */}
        <div className="lg:col-span-5">
          <Card surface="matte" className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-[#9b2c63]" />
                <h2 className="font-display text-lg font-bold text-charcoal">
                  Trusted Contacts ({contacts.length})
                </h2>
              </div>
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={() => openContactModal(null)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>

            {contacts.length === 0 ? (
              <p className="rounded-2xl bg-warm-white p-4 text-xs text-charcoal-muted">
                No trusted contacts saved yet. Add family members or friends you want
                available for Journey Watch.
              </p>
            ) : (
              <div className="space-y-3">
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="space-y-2.5 rounded-2xl border border-border-soft bg-warm-white p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-display text-sm font-bold text-charcoal">
                            {contact.name}
                          </p>
                          {contact.is_primary && <Badge tone="mint">Primary</Badge>}
                        </div>
                        <p className="text-xs text-charcoal-muted">
                          {contact.relationship || 'Trusted Contact'} · {contact.phone}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openContactModal(contact)}
                          aria-label={`Edit ${contact.name}`}
                          className="rounded-full p-1.5 text-charcoal-muted hover:bg-pure-white hover:text-charcoal"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteContact(contact.id)}
                          aria-label={`Delete ${contact.name}`}
                          className="rounded-full p-1.5 text-charcoal-muted hover:bg-[var(--color-error-soft)] hover:text-[var(--color-error-deep)]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold">
                      {contact.notify_on_journey_start && (
                        <span className="rounded-full bg-pure-white px-2.5 py-0.5 text-charcoal-muted">
                          Notify on Start
                        </span>
                      )}
                      {contact.notify_on_missed_checkin && (
                        <span className="rounded-full bg-pure-white px-2.5 py-0.5 text-charcoal-muted">
                          Missed Check-In Alert
                        </span>
                      )}
                      {contact.notify_on_arrival && (
                        <span className="rounded-full bg-pure-white px-2.5 py-0.5 text-charcoal-muted">
                          Arrival Notice
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <EmergencyBanner />

      <Modal
        open={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        title={editingContact ? 'Edit Trusted Contact' : 'Add Trusted Contact'}
      >
        <form onSubmit={handleSaveContact} className="space-y-4">
          <Input
            label="Name"
            value={cName}
            onChange={(e) => setCName(e.target.value)}
            placeholder="e.g. Meera Rao"
            required
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Relationship"
              value={cRel}
              onChange={(e) => setCRel(e.target.value)}
              placeholder="Sister, Friend, Parent"
            />
            <Input
              label="Phone Number"
              value={cPhone}
              onChange={(e) => setCPhone(e.target.value)}
              placeholder="+91-90000-00000"
              required
            />
          </div>
          <Input
            label="Email (Optional)"
            type="email"
            value={cEmail}
            onChange={(e) => setCEmail(e.target.value)}
            placeholder="contact@example.com"
          />

          <div className="space-y-2 rounded-2xl bg-warm-white p-3.5 text-xs">
            <p className="font-semibold text-charcoal">Notification Preferences</p>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={cPrimary}
                onChange={(e) => setCPrimary(e.target.checked)}
                className="accent-[#68bfa3]"
              />
              Mark as Primary Trusted Contact
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={cNotifyStart}
                onChange={(e) => setCNotifyStart(e.target.checked)}
                className="accent-[#68bfa3]"
              />
              Notify when Journey Watch starts
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={cNotifyMissed}
                onChange={(e) => setCNotifyMissed(e.target.checked)}
                className="accent-[#68bfa3]"
              />
              Notify on missed check-in reminder
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={cNotifyArrival}
                onChange={(e) => setCNotifyArrival(e.target.checked)}
                className="accent-[#68bfa3]"
              />
              Notify on safe arrival
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setContactModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="primary" disabled={busy}>
              {busy ? 'Saving...' : 'Save Contact'}
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
