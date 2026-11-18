import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Power,
  Plus,
  RefreshCw,
  XCircle,
  ShieldCheck,
  Radio,
} from 'lucide-react';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/context/ToastContext';
import {
  acceptHelpRequest,
  ApiError,
  closeHelpRequest,
  declineHelpRequest,
  fetchHelpRequests,
  fetchMyPartners,
  markHelpRequestArrived,
  updatePartnerAvailability,
} from '@/services/api';
import type {
  HelpRequestItem,
  PartnerAvailabilityStatus,
  PartnerOwnerItem,
} from '@/types';

const STATUS_OPTIONS: Array<{
  value: PartnerAvailabilityStatus;
  label: string;
  desc: string;
}> = [
  { value: 'AVAILABLE', label: 'Available', desc: 'Ready to accept assistance requests' },
  { value: 'BUSY', label: 'Busy', desc: 'Limited capacity; visible with Busy badge' },
  { value: 'OFFLINE', label: 'Offline', desc: 'Paused; users cannot send new requests' },
];

export function PartnerDashboardPage() {
  const { pushToast } = useToast();
  const [partners, setPartners] = useState<PartnerOwnerItem[]>([]);
  const [requests, setRequests] = useState<HelpRequestItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [responseNotes, setResponseNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [updatingAvail, setUpdatingAvail] = useState(false);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);

  const loadConsole = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [partnerRes, reqRes] = await Promise.all([
          fetchMyPartners(),
          fetchHelpRequests(),
        ]);
        setPartners(partnerRes.results);
        setRequests(reqRes.results);
        if (partnerRes.results.length > 0) {
          setSelectedId((prev) => {
            const match =
              partnerRes.results.find((p) => p.id === prev) || partnerRes.results[0];
            if (!silent) setStatusNote(match.availability?.status_note || '');
            return match.id;
          });
        }
      } catch (err) {
        if (!silent) {
          pushToast({
            tone: 'error',
            title: 'Could not load partner console',
            description: err instanceof ApiError ? err.message : 'Check backend connection.',
          });
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [pushToast]
  );

  useEffect(() => {
    loadConsole(false);
    const interval = window.setInterval(() => loadConsole(true), 6000);
    return () => window.clearInterval(interval);
  }, [loadConsole]);

  const activePartner = partners.find((p) => p.id === selectedId) || null;

  const incomingRequests = useMemo(
    () => requests.filter((r) => r.status === 'PENDING'),
    [requests]
  );
  const activeRequests = useMemo(
    () => requests.filter((r) => r.status === 'ACCEPTED' || r.status === 'ARRIVED'),
    [requests]
  );
  const historyRequests = useMemo(
    () =>
      requests.filter(
        (r) => !['PENDING', 'ACCEPTED', 'ARRIVED'].includes(r.status)
      ),
    [requests]
  );

  const handleAvailabilityChange = async (nextStatus: PartnerAvailabilityStatus) => {
    if (!activePartner) return;
    setUpdatingAvail(true);
    try {
      const res = await updatePartnerAvailability(
        activePartner.id,
        nextStatus,
        statusNote.trim()
      );
      setPartners((prev) =>
        prev.map((p) =>
          p.id === activePartner.id ? { ...p, availability: res.availability } : p
        )
      );
      pushToast({
        tone: 'success',
        title: `Availability set to ${nextStatus}`,
        description: `${activePartner.name} is now ${nextStatus.toLowerCase()}.`,
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Availability update rejected',
        description: err instanceof ApiError ? err.message : 'Unable to update status.',
      });
    } finally {
      setUpdatingAvail(false);
    }
  };

  const runRequestAction = async (
    id: string,
    action: 'accept' | 'decline' | 'arrived' | 'close'
  ) => {
    setBusyRequestId(id);
    const note = (responseNotes[id] || '').trim();
    try {
      let updated: HelpRequestItem;
      if (action === 'accept') {
        updated = await acceptHelpRequest(id, note || 'Front desk staff ready to assist.');
      } else if (action === 'decline') {
        updated = await declineHelpRequest(id, note || 'Unable to accommodate right now.');
      } else if (action === 'arrived') {
        updated = await markHelpRequestArrived(id);
      } else {
        updated = await closeHelpRequest(id, note || 'Assistance completed safely.');
      }
      setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      pushToast({
        tone: 'success',
        title: `Request ${updated.status}`,
        description: `Status updated for ${updated.requester_name}.`,
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Action failed',
        description: err instanceof ApiError ? err.message : 'Please try again.',
      });
    } finally {
      setBusyRequestId(null);
    }
  };

  return (
    <DashboardLayout
      title="Partner Operational Console"
      subtitle="Manage live availability, accept incoming assistance requests swiftly, and track completed support."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {partners.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setSelectedId(p.id);
                setStatusNote(p.availability?.status_note || '');
              }}
              className={`neu-chip px-3.5 py-1.5 text-xs font-semibold ${
                p.id === selectedId ? 'neu-chip-active' : ''
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => loadConsole(false)}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Link to="/partner/establishment">
            <Button type="button" size="sm" variant="primary">
              <Plus className="h-3.5 w-3.5" />
              {partners.length > 0 ? 'Manage Establishment' : 'Register Establishment'}
            </Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="surface-matte h-48 animate-pulse p-6" />
      ) : !activePartner ? (
        <Card surface="matte" className="space-y-4 p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-mint-soft text-mint-deep">
            <Building2 className="h-6 w-6" />
          </span>
          <h2 className="font-display text-xl font-bold text-charcoal">
            Register your SafeStop establishment
          </h2>
          <p className="mx-auto max-w-md text-sm text-charcoal-muted">
            Submit your establishment details for administrator approval before accepting
            live assistance requests.
          </p>
          <Link to="/partner/establishment">
            <Button variant="primary" size="md" type="button">
              Submit Establishment
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Verification Status Banner */}
          <Card
            surface="matte"
            className={`flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center ${
              activePartner.verification_status === 'APPROVED'
                ? 'border-mint-dark/50'
                : 'border-[var(--color-warning)]'
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                  activePartner.verification_status === 'APPROVED'
                    ? 'bg-mint-soft text-mint-deep'
                    : 'bg-[var(--color-warning-soft)] text-[var(--color-warning-deep)]'
                }`}
              >
                {activePartner.verification_status === 'APPROVED' ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <AlertTriangle className="h-5 w-5" />
                )}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-lg font-bold text-charcoal">
                    {activePartner.name}
                  </h2>
                  <Badge
                    tone={
                      activePartner.verification_status === 'APPROVED'
                        ? 'mint'
                        : activePartner.verification_status === 'PENDING'
                          ? 'warning'
                          : 'error'
                    }
                  >
                    {activePartner.verification_status}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-charcoal-muted">
                  {activePartner.category_display} · {activePartner.address}
                </p>
              </div>
            </div>
            <Link to="/partner/establishment">
              <Button size="sm" variant="secondary" type="button">
                Edit Details
              </Button>
            </Link>
          </Card>

          {/* Operational Incoming Assistance Requests Queue */}
          <Card surface="matte" className="space-y-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Radio className="h-5 w-5 text-mint-deep" aria-hidden="true" />
                <h3 className="font-display text-lg font-bold text-charcoal">
                  Incoming Assistance Requests ({incomingRequests.length})
                </h3>
              </div>
              <Badge tone="mint">Live polling · 6s</Badge>
            </div>

            {incomingRequests.length === 0 ? (
              <p className="rounded-2xl bg-warm-white p-4 text-sm text-charcoal-muted">
                No pending requests right now. New requests will appear here automatically.
              </p>
            ) : (
              <div className="space-y-3">
                {incomingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="space-y-3 rounded-2xl border border-[var(--color-warning)] bg-[var(--color-warning-soft)]/45 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge tone="warning">PENDING</Badge>
                          <span className="font-display text-base font-bold text-charcoal">
                            {req.requester_name}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-charcoal-muted">
                          For: <strong>{req.partner_name}</strong> ·{' '}
                          {new Date(req.created_at).toLocaleTimeString()}
                          {req.estimated_arrival_minutes
                            ? ` · Est. ${req.estimated_arrival_minutes} min away`
                            : ''}
                        </p>
                        {req.note && (
                          <p className="mt-2 rounded-xl bg-white/90 px-3 py-2 text-xs text-charcoal">
                            Note: &ldquo;{req.note}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        value={responseNotes[req.id] || ''}
                        onChange={(e) =>
                          setResponseNotes((prev) => ({
                            ...prev,
                            [req.id]: e.target.value,
                          }))
                        }
                        placeholder="Optional message to requester (e.g., Front desk ready at entrance)"
                        className="neu-input-pill flex-1 px-3.5 py-2 text-xs text-charcoal focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="primary"
                          disabled={busyRequestId === req.id}
                          onClick={() => runRequestAction(req.id, 'accept')}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Accept
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          disabled={busyRequestId === req.id}
                          onClick={() => runRequestAction(req.id, 'decline')}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Decline
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Active En-Route / Arrived Support */}
          {activeRequests.length > 0 && (
            <Card surface="matte" className="border-mint-dark/50 space-y-4 p-6">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-mint-deep" />
                <h3 className="font-display text-lg font-bold text-charcoal">
                  Active Assistance In Progress ({activeRequests.length})
                </h3>
              </div>
              <div className="space-y-3">
                {activeRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex flex-col justify-between gap-3 rounded-2xl border border-border-soft bg-warm-white p-4 sm:flex-row sm:items-center"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge tone={req.status === 'ARRIVED' ? 'blue' : 'mint'}>
                          {req.status}
                        </Badge>
                        <span className="font-display text-sm font-bold text-charcoal">
                          {req.requester_name}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-charcoal-muted">
                        {req.partner_name}
                        {req.note ? ` · "${req.note}"` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {req.status === 'ACCEPTED' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busyRequestId === req.id}
                          onClick={() => runRequestAction(req.id, 'arrived')}
                        >
                          Mark Arrived
                        </Button>
                      )}
                      {req.status === 'ARRIVED' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="primary"
                          disabled={busyRequestId === req.id}
                          onClick={() => runRequestAction(req.id, 'close')}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Mark Completed
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Operational Availability Toggle */}
          <Card surface="matte" className="space-y-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Power className="h-5 w-5 text-mint-deep" aria-hidden="true" />
                <h3 className="font-display text-lg font-bold text-charcoal">
                  Live Operational Availability
                </h3>
              </div>
              <Badge
                tone={
                  activePartner.availability?.status === 'AVAILABLE'
                    ? 'mint'
                    : activePartner.availability?.status === 'BUSY'
                      ? 'warning'
                      : 'neutral'
                }
              >
                Current: {activePartner.availability?.status || 'OFFLINE'}
              </Badge>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {STATUS_OPTIONS.map((opt) => {
                const isActive = activePartner.availability?.status === opt.value;
                const disabled =
                  updatingAvail ||
                  (activePartner.verification_status !== 'APPROVED' &&
                    opt.value !== 'OFFLINE');
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleAvailabilityChange(opt.value)}
                    className={`rounded-2xl border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-55 ${
                      isActive
                        ? 'border-mint-dark bg-mint-soft/60 shadow-sm'
                        : 'border-border-soft bg-warm-white hover:border-mint-dark/60'
                    }`}
                  >
                    <p className="font-display text-sm font-bold text-charcoal">
                      {opt.label}
                    </p>
                    <p className="mt-1 text-xs text-charcoal-muted">{opt.desc}</p>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                maxLength={180}
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder="Optional operational note (e.g., Front desk staffed until midnight)"
                className="neu-input-pill flex-1 px-3.5 py-2 text-sm text-charcoal focus:outline-none"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={updatingAvail || activePartner.verification_status !== 'APPROVED'}
                onClick={() =>
                  handleAvailabilityChange(
                    activePartner.availability?.status || 'AVAILABLE'
                  )
                }
              >
                Save Note
              </Button>
            </div>
          </Card>

          {/* Request History Table */}
          <Card surface="matte" className="space-y-3 p-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-charcoal-muted" />
              <h3 className="font-display text-base font-bold text-charcoal">
                Past Assistance History ({historyRequests.length})
              </h3>
            </div>
            {historyRequests.length === 0 ? (
              <p className="text-xs text-charcoal-muted">No completed or declined requests yet.</p>
            ) : (
              <div className="space-y-2">
                {historyRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-warm-white px-4 py-2.5 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-charcoal">{req.requester_name}</span>{' '}
                      · <span className="text-charcoal-muted">{req.partner_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={req.status === 'CLOSED' ? 'violet' : 'neutral'}>
                        {req.status}
                      </Badge>
                      <span className="text-charcoal-muted">
                        {new Date(req.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
