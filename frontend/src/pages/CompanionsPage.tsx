import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Users,
  ShieldCheck,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  Power,
  Send,
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
  actOnCompanionRequest,
  ApiError,
  createCompanionRequest,
  fetchApprovedCompanions,
  fetchCompanionRequests,
  fetchMyCompanionProfile,
  registerCompanion,
  toggleCompanionAvailability,
} from '@/services/api';
import type { CompanionItem, CompanionRequestItem } from '@/types';

export function CompanionsPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();

  const [companions, setCompanions] = useState<CompanionItem[]>([]);
  const [myCompanion, setMyCompanion] = useState<CompanionItem | null>(null);
  const [requests, setRequests] = useState<CompanionRequestItem[]>([]);
  const [areaFilter, setAreaFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Request Companion Modal
  const [requestTarget, setRequestTarget] = useState<CompanionItem | null>(null);
  const [pickupArea, setPickupArea] = useState('');
  const [destArea, setDestArea] = useState('');
  const [minutesFromNow, setMinutesFromNow] = useState('45');
  const [reqNote, setReqNote] = useState('');

  // Become a Companion Modal
  const [applyOpen, setApplyOpen] = useState(false);
  const [displayName, setDisplayName] = useState(user?.full_name || '');
  const [bio, setBio] = useState('');
  const [serviceAreasText, setServiceAreasText] = useState('Indiranagar, MG Road');
  const [languagesText, setLanguagesText] = useState('English, Kannada, Hindi');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [compRes, myRes, reqRes] = await Promise.all([
        fetchApprovedCompanions({ area: areaFilter }),
        fetchMyCompanionProfile(),
        fetchCompanionRequests(),
      ]);
      setCompanions(compRes.results);
      setMyCompanion(myRes.companion);
      setRequests(reqRes.results);
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Could not load companions',
        description: err instanceof ApiError ? err.message : 'Check backend connection.',
      });
    } finally {
      setLoading(false);
    }
  }, [areaFilter, pushToast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleSendRequest = async (e: FormEvent) => {
    e.preventDefault();
    if (!requestTarget) return;
    setBusy(true);
    try {
      const scheduled = new Date(
        Date.now() + Number(minutesFromNow || 30) * 60000
      ).toISOString();
      const created = await createCompanionRequest({
        companion: requestTarget.id,
        pickup_area: pickupArea.trim(),
        destination_area: destArea.trim(),
        scheduled_for: scheduled,
        note: reqNote.trim(),
      });
      setRequests((prev) => [created, ...prev]);
      setRequestTarget(null);
      setPickupArea('');
      setDestArea('');
      setReqNote('');
      pushToast({
        tone: 'success',
        title: 'Companion request sent',
        description: `Waiting for ${created.companion_name} to respond.`,
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Request failed',
        description: err instanceof ApiError ? err.message : 'Check fields.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleApply = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const created = await registerCompanion({
        display_name: displayName.trim(),
        bio: bio.trim(),
        service_areas: serviceAreasText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        languages: languagesText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setMyCompanion(created);
      setApplyOpen(false);
      pushToast({
        tone: 'success',
        title: 'Companion application submitted',
        description: 'Status is PENDING until verified by an administrator.',
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Application failed',
        description: err instanceof ApiError ? err.message : 'Check input.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleMyAvailability = async () => {
    if (!myCompanion) return;
    setBusy(true);
    try {
      const updated = await toggleCompanionAvailability(!myCompanion.is_available);
      setMyCompanion(updated);
      pushToast({
        tone: 'success',
        title: updated.is_available ? 'Marked Available' : 'Marked Unavailable',
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Could not toggle availability',
        description: err instanceof ApiError ? err.message : 'Approval required.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRequestAction = async (
    id: string,
    action: 'accept' | 'decline' | 'complete' | 'cancel'
  ) => {
    setBusy(true);
    try {
      const updated = await actOnCompanionRequest(id, action);
      setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      pushToast({ tone: 'success', title: `Companion request ${updated.status}` });
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

  return (
    <DashboardLayout
      title="Verified Companions"
      subtitle="Request accompaniment from strictly administrator-verified companions for walks or transit. Unverified applicants never appear publicly."
    >
      {/* Top Bar: Area Filter + Become a Companion / Own Companion Status */}
      <Card surface="matte" className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2">
          <input
            type="search"
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            placeholder="Filter verified companions by neighbourhood (e.g. Indiranagar, Koramangala)..."
            className="neu-input-pill w-full max-w-md px-3.5 py-2 text-sm text-charcoal focus:outline-none"
          />
        </div>

        {myCompanion ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge
              tone={
                myCompanion.verification_status === 'APPROVED'
                  ? 'mint'
                  : myCompanion.verification_status === 'PENDING'
                    ? 'warning'
                    : 'error'
              }
            >
              My Companion Status: {myCompanion.verification_status}
            </Badge>
            {myCompanion.verification_status === 'APPROVED' && (
              <Button
                type="button"
                size="sm"
                variant={myCompanion.is_available ? 'primary' : 'secondary'}
                disabled={busy}
                onClick={handleToggleMyAvailability}
              >
                <Power className="h-3.5 w-3.5" />
                {myCompanion.is_available ? 'Available' : 'Unavailable'}
              </Button>
            )}
          </div>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setApplyOpen(true)}
          >
            <Users className="h-3.5 w-3.5" />
            Apply as Companion
          </Button>
        )}
      </Card>

      {/* Verified Companions Grid */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="surface-matte h-44 animate-pulse p-5" />
          ))}
        </div>
      ) : companions.length === 0 ? (
        <Card surface="matte" className="p-6 text-center text-sm text-charcoal-muted">
          No administrator-verified companions match this area filter.
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {companions.map((comp) => (
            <Card key={comp.id} surface="matte" interactive className="flex flex-col justify-between space-y-4 p-5">
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge tone="mint">
                      <ShieldCheck className="h-3 w-3" />
                      Admin Verified
                    </Badge>
                    {comp.is_demo && <Badge tone="violet">Demo</Badge>}
                  </div>
                  <Badge tone={comp.is_available ? 'mint' : 'neutral'}>
                    {comp.is_available ? 'Available' : 'Offline'}
                  </Badge>
                </div>
                <h2 className="font-display text-lg font-bold text-charcoal">
                  {comp.display_name}
                </h2>
                <p className="text-xs leading-relaxed text-charcoal-muted">{comp.bio}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {comp.service_areas.map((area) => (
                    <span
                      key={area}
                      className="inline-flex items-center gap-1 rounded-full bg-warm-white px-2.5 py-1 text-[11px] font-medium text-charcoal"
                    >
                      <MapPin className="h-3 w-3 text-mint-deep" />
                      {area}
                    </span>
                  ))}
                </div>
                {comp.languages.length > 0 && (
                  <p className="text-[11px] text-charcoal-muted">
                    Languages: {comp.languages.join(', ')}
                  </p>
                )}
              </div>

              <div className="border-t border-border-soft pt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  disabled={!comp.is_available || comp.user === user?.id}
                  onClick={() => setRequestTarget(comp)}
                >
                  <Send className="h-3.5 w-3.5" />
                  {comp.user === user?.id
                    ? 'Your Profile'
                    : comp.is_available
                      ? 'Request Companion'
                      : 'Currently Unavailable'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Companion Requests History & Actions */}
      <Card surface="matte" className="space-y-4 p-6">
        <h2 className="font-display text-lg font-bold text-charcoal">
          My Companion Requests ({requests.length})
        </h2>
        {requests.length === 0 ? (
          <p className="text-xs text-charcoal-muted">No companion requests yet.</p>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => {
              const isIncoming = myCompanion && req.companion === myCompanion.id;
              return (
                <div
                  key={req.id}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-border-soft bg-warm-white p-4 sm:flex-row sm:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          req.status === 'ACCEPTED'
                            ? 'mint'
                            : req.status === 'COMPLETED'
                              ? 'violet'
                              : req.status === 'PENDING'
                                ? 'warning'
                                : 'neutral'
                        }
                      >
                        {req.status_display}
                      </Badge>
                      <span className="font-display text-sm font-bold text-charcoal">
                        {req.pickup_area} → {req.destination_area}
                      </span>
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-charcoal-muted">
                      <Clock className="h-3 w-3" />
                      {new Date(req.scheduled_for).toLocaleString()} · Companion:{' '}
                      <strong>{req.companion_name}</strong>
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {isIncoming && req.status === 'PENDING' && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="primary"
                          disabled={busy}
                          onClick={() => handleRequestAction(req.id, 'accept')}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Accept
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          disabled={busy}
                          onClick={() => handleRequestAction(req.id, 'decline')}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Decline
                        </Button>
                      </>
                    )}
                    {isIncoming && req.status === 'ACCEPTED' && (
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        disabled={busy}
                        onClick={() => handleRequestAction(req.id, 'complete')}
                      >
                        Mark Completed
                      </Button>
                    )}
                    {!isIncoming && req.status === 'PENDING' && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => handleRequestAction(req.id, 'cancel')}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <EmergencyBanner />

      {/* Request Companion Modal */}
      <Modal
        open={Boolean(requestTarget)}
        onClose={() => setRequestTarget(null)}
        title={`Request Companion: ${requestTarget?.display_name || ''}`}
        subtitle="Specify your pickup area, destination, and time."
      >
        <form onSubmit={handleSendRequest} className="space-y-4">
          <Input
            label="Pickup Area / Landmark"
            value={pickupArea}
            onChange={(e) => setPickupArea(e.target.value)}
            placeholder="e.g. Indiranagar Metro Gate B"
            required
          />
          <Input
            label="Destination Area"
            value={destArea}
            onChange={(e) => setDestArea(e.target.value)}
            placeholder="e.g. 12th Main Indiranagar"
            required
          />
          <Input
            label="Scheduled Time (minutes from now)"
            type="number"
            min={5}
            max={720}
            value={minutesFromNow}
            onChange={(e) => setMinutesFromNow(e.target.value)}
            required
          />
          <Input
            label="Optional Note"
            value={reqNote}
            onChange={(e) => setReqNote(e.target.value)}
            placeholder="Any helpful context for the companion"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setRequestTarget(null)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="primary" disabled={busy}>
              {busy ? 'Sending...' : 'Send Companion Request'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Apply as Companion Modal */}
      <Modal
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        title="Apply to Become a Verified Companion"
        subtitle="All applications require administrator approval before becoming visible."
      >
        <form onSubmit={handleApply} className="space-y-4">
          <Input
            label="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          <Input
            label="Service Areas (comma-separated)"
            value={serviceAreasText}
            onChange={(e) => setServiceAreasText(e.target.value)}
            required
          />
          <Input
            label="Languages (comma-separated)"
            value={languagesText}
            onChange={(e) => setLanguagesText(e.target.value)}
          />
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-charcoal">Short Bio</label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Share your usual commute areas and availability..."
              className="neu-input-pill w-full px-3.5 py-2.5 text-sm text-charcoal focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setApplyOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="primary" disabled={busy}>
              {busy ? 'Submitting...' : 'Submit Application'}
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
