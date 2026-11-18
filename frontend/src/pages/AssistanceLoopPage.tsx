import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Radio,
  CheckCircle2,
  MapPin,
  Phone,
  Navigation,
  ExternalLink,
  Clock,
  Star,
  RefreshCw,
  XCircle,
  Send,
} from 'lucide-react';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { buildDirectionsUrl } from '@/components/map/SafePlacesMap';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmergencyBanner } from '@/components/ui/EmergencyBanner';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  ApiError,
  cancelHelpRequest,
  createHelpRequest,
  fetchHelpRequests,
  fetchNearbyPartners,
  markHelpRequestArrived,
  submitHelpRequestFeedback,
} from '@/services/api';
import type { HelpRequestItem, HelpRequestStatus, PartnerItem } from '@/types';

const ACTIVE_STATUSES: HelpRequestStatus[] = ['PENDING', 'ACCEPTED', 'ARRIVED'];

function statusTone(
  status: HelpRequestStatus
): 'mint' | 'warning' | 'blue' | 'violet' | 'error' | 'neutral' {
  switch (status) {
    case 'PENDING':
      return 'warning';
    case 'ACCEPTED':
      return 'mint';
    case 'ARRIVED':
      return 'blue';
    case 'CLOSED':
      return 'violet';
    case 'DECLINED':
    case 'EXPIRED':
      return 'error';
    default:
      return 'neutral';
  }
}

export function AssistanceLoopPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [searchParams] = useSearchParams();

  const [requests, setRequests] = useState<HelpRequestItem[]>([]);
  const [partners, setPartners] = useState<PartnerItem[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(
    searchParams.get('partner') || ''
  );
  const [note, setNote] = useState(user?.profile?.emergency_note || '');
  const [etaMinutes, setEtaMinutes] = useState('10');
  const [shareApproxLocation, setShareApproxLocation] = useState(false);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Feedback form state for latest closed request without feedback
  const [rating, setRating] = useState(5);
  const [feltSafe, setFeltSafe] = useState(true);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const originLat = Number(searchParams.get('lat')) || 12.978369;
  const originLng = Number(searchParams.get('lng')) || 77.640836;

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [reqRes, partnerRes] = await Promise.all([
        fetchHelpRequests(),
        fetchNearbyPartners({ lat: originLat, lng: originLng, radius_km: 35 }),
      ]);
      setRequests(reqRes.results);
      const selectable = partnerRes.results.filter(
        (p) => p.availability?.status !== 'OFFLINE'
      );
      setPartners(selectable);
      setSelectedPartnerId((prev) => {
        if (prev && selectable.some((p) => p.id === prev)) return prev;
        return selectable[0]?.id || '';
      });
    } catch (err) {
      if (!silent) {
        pushToast({
          tone: 'error',
          title: 'Could not load assistance data',
          description: err instanceof ApiError ? err.message : 'Check backend connection.',
        });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [originLat, originLng, pushToast]);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  const activeRequest = useMemo(
    () => requests.find((r) => ACTIVE_STATUSES.includes(r.status)) || null,
    [requests]
  );

  // Reliable 5-second live polling while an assistance request is active
  useEffect(() => {
    if (!activeRequest) return;
    const interval = window.setInterval(() => {
      loadData(true);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [activeRequest, loadData]);

  const handleSendRequest = async (event: FormEvent) => {
    event.preventDefault();
    setSendError(null);
    if (!selectedPartnerId) {
      setSendError('Please choose an approved, available SafeStop establishment.');
      return;
    }

    setSending(true);
    try {
      const created = await createHelpRequest({
        partner: selectedPartnerId,
        note: note.trim(),
        estimated_arrival_minutes: etaMinutes ? Number(etaMinutes) : null,
        requester_latitude: shareApproxLocation ? Number(originLat.toFixed(6)) : null,
        requester_longitude: shareApproxLocation ? Number(originLng.toFixed(6)) : null,
      });
      setRequests((prev) => [created, ...prev]);
      pushToast({
        tone: 'success',
        title: 'Assistance request sent',
        description: `Waiting for ${created.partner_name} to confirm readiness.`,
      });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Failed to send request. No request was created—please try again or call 112.';
      setSendError(message);
      pushToast({ tone: 'error', title: 'Request not sent', description: message });
    } finally {
      setSending(false);
    }
  };

  const handleConfirmArrival = async (id: string) => {
    setActionBusy(true);
    try {
      const updated = await markHelpRequestArrived(id);
      setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      pushToast({
        tone: 'success',
        title: 'Arrival confirmed',
        description: `${updated.partner_name} has been notified that you reached safely.`,
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Could not confirm arrival',
        description: err instanceof ApiError ? err.message : 'Please try again.',
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleCancel = async (id: string) => {
    setActionBusy(true);
    try {
      const updated = await cancelHelpRequest(id);
      setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      pushToast({ tone: 'info', title: 'Assistance request cancelled' });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Cancellation failed',
        description: err instanceof ApiError ? err.message : 'Please try again.',
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleSubmitFeedback = async (id: string) => {
    setSubmittingFeedback(true);
    try {
      const fb = await submitHelpRequestFeedback(id, {
        rating,
        felt_safe: feltSafe,
        comment: feedbackComment.trim(),
      });
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, feedback: fb } : r))
      );
      setFeedbackComment('');
      pushToast({
        tone: 'success',
        title: 'Thank you for your feedback',
        description: 'Your feedback helps SafeStop 360 keep partner standards high.',
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Could not save feedback',
        description: err instanceof ApiError ? err.message : 'Please try again.',
      });
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const pendingFeedbackRequest = useMemo(
    () => requests.find((r) => r.status === 'CLOSED' && !r.feedback) || null,
    [requests]
  );

  return (
    <DashboardLayout
      title="Assistance Confirmation Loop"
      subtitle="Send a discreet request to a verified establishment, watch live partner confirmation, confirm arrival, and close the loop."
    >
      {/* Active Live Assistance Loop Panel (3D Glassmorphism showcase!) */}
      <AnimatePresence mode="wait">
        {activeRequest ? (
          <motion.div
            key={`${activeRequest.id}-${activeRequest.status}`}
            initial={{ opacity: 0, y: 14, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35 }}
          >
            <Card surface="glass-3d" className="space-y-5 p-6 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Badge tone={statusTone(activeRequest.status)}>
                    <Radio className="h-3 w-3 animate-pulse" aria-hidden="true" />
                    Status: {activeRequest.status}
                  </Badge>
                  <span className="text-xs font-medium text-charcoal-muted">
                    Auto-updating every 5s
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => loadData(false)}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh Now
                </Button>
              </div>

              {/* 4-Stage Progress Bar */}
              <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
                {(['PENDING', 'ACCEPTED', 'ARRIVED', 'CLOSED'] as const).map((step, idx) => {
                  const currentIdx = ['PENDING', 'ACCEPTED', 'ARRIVED', 'CLOSED'].indexOf(
                    activeRequest.status
                  );
                  const reached = idx <= currentIdx;
                  return (
                    <div key={step} className="space-y-1.5">
                      <div
                        className={`h-2 rounded-full transition-colors ${
                          reached ? 'bg-mint-dark' : 'bg-white/70'
                        }`}
                      />
                      <span
                        className={`block font-semibold ${
                          reached ? 'text-charcoal' : 'text-charcoal-muted'
                        }`}
                      >
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* State-specific dynamic card content */}
              {activeRequest.status === 'PENDING' && (
                <div className="rounded-2xl bg-white/80 p-5">
                  <h2 className="font-display text-xl font-bold text-charcoal">
                    Waiting for {activeRequest.partner_name} to confirm
                  </h2>
                  <p className="mt-1.5 text-sm text-charcoal-muted">
                    Your discreet request is live on their partner console. You will see
                    their confirmation, front-desk note, and direct route here as soon as
                    they accept.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      disabled={actionBusy}
                      onClick={() => handleCancel(activeRequest.id)}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Cancel Request
                    </Button>
                    <Link to="/app/map">
                      <Button type="button" size="sm" variant="secondary">
                        View Other SafeStops
                      </Button>
                    </Link>
                  </div>
                </div>
              )}

              {activeRequest.status === 'ACCEPTED' && (
                <div className="space-y-4 rounded-2xl border border-mint-dark/40 bg-white/88 p-5">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-mint-soft text-mint-deep">
                      <CheckCircle2 className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="font-display text-xl font-bold text-charcoal">
                        Partner Confirmed! {activeRequest.partner_name} is ready for you
                      </h2>
                      <p className="mt-1 text-xs text-charcoal-muted">
                        {activeRequest.partner_category} · {activeRequest.partner_address}
                      </p>
                      {activeRequest.partner_response_note && (
                        <p className="mt-2 rounded-xl bg-mint-soft/60 px-3 py-2 text-xs font-medium text-mint-deep">
                          Partner message: &ldquo;{activeRequest.partner_response_note}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      size="md"
                      variant="primary"
                      disabled={actionBusy}
                      onClick={() => handleConfirmArrival(activeRequest.id)}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {actionBusy ? 'Updating...' : 'I Have Arrived Safely'}
                    </Button>

                    <a
                      href={buildDirectionsUrl(
                        originLat,
                        originLng,
                        activeRequest.partner_latitude,
                        activeRequest.partner_longitude
                      )}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Button type="button" size="md" variant="secondary">
                        <Navigation className="h-4 w-4" />
                        Open Directions
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </a>

                    <a href={`tel:${activeRequest.partner_phone}`}>
                      <Button type="button" size="md" variant="secondary">
                        <Phone className="h-4 w-4" />
                        {activeRequest.partner_phone}
                      </Button>
                    </a>

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={actionBusy}
                      onClick={() => handleCancel(activeRequest.id)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {activeRequest.status === 'ARRIVED' && (
                <div className="rounded-2xl bg-white/85 p-5">
                  <h2 className="font-display text-xl font-bold text-charcoal">
                    Safe Arrival Recorded at {activeRequest.partner_name}
                  </h2>
                  <p className="mt-1.5 text-sm text-charcoal-muted">
                    Take your time inside the verified SafeStop. Once you are ready to
                    continue safely, staff at {activeRequest.partner_name} will mark the
                    request completed.
                  </p>
                </div>
              )}
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="new-request-form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card surface="matte" className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-bold text-charcoal">
                    Send a Discreet Assistance Request
                  </h2>
                  <p className="text-xs text-charcoal-muted">
                    Only administrator-approved, online establishments appear below.
                  </p>
                </div>
                <Link to="/app/map">
                  <Button type="button" size="sm" variant="secondary">
                    <MapPin className="h-3.5 w-3.5" />
                    Pick on Map
                  </Button>
                </Link>
              </div>

              {sendError && (
                <div
                  role="alert"
                  className="mt-4 rounded-2xl border border-[var(--color-error)] bg-[var(--color-error-soft)] px-4 py-3 text-xs font-medium text-[var(--color-error-deep)]"
                >
                  {sendError}
                </div>
              )}

              <form onSubmit={handleSendRequest} className="mt-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="block text-xs font-semibold text-charcoal">
                      Select Verified SafeStop Partner
                    </label>
                    <select
                      value={selectedPartnerId}
                      onChange={(e) => setSelectedPartnerId(e.target.value)}
                      className="neu-input-pill w-full px-3.5 py-2.5 text-sm text-charcoal focus:outline-none"
                      required
                    >
                      {partners.length === 0 ? (
                        <option value="">No available partners found</option>
                      ) : (
                        partners.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.area || p.city} · {p.availability?.status})
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-charcoal">
                      Est. Arrival (mins)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={etaMinutes}
                      onChange={(e) => setEtaMinutes(e.target.value)}
                      className="neu-input-pill w-full px-3.5 py-2.5 text-sm text-charcoal focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-charcoal">
                    Optional Note for Partner Front Desk
                  </label>
                  <textarea
                    rows={2}
                    maxLength={320}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Waiting for my ride, phone battery low, need a well-lit place to wait."
                    className="neu-input-pill w-full px-3.5 py-2.5 text-sm text-charcoal focus:outline-none"
                  />
                </div>

                <label className="flex cursor-pointer items-center gap-2.5 rounded-2xl bg-warm-white px-4 py-3 text-xs text-charcoal-muted">
                  <input
                    type="checkbox"
                    checked={shareApproxLocation}
                    onChange={(e) => setShareApproxLocation(e.target.checked)}
                    className="h-4 w-4 accent-[#68bfa3]"
                  />
                  <span>
                    Opt-in: Share my approximate starting coordinates ONLY with this
                    selected partner during this active request.
                  </span>
                </label>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={sending || !selectedPartnerId}
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  {sending ? 'Sending Discreet Request...' : 'Send Assistance Request'}
                </Button>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Optional Post-Completion Feedback Card */}
      {pendingFeedbackRequest && (
        <Card surface="matte" className="border-mint-dark/50 space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <Badge tone="mint">Completed Support · Optional Feedback</Badge>
              <h3 className="mt-2 font-display text-lg font-bold text-charcoal">
                How was your experience at {pendingFeedbackRequest.partner_name}?
              </h3>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  aria-label={`Rate ${star} out of 5`}
                  className={`rounded-full p-1.5 transition-colors ${
                    star <= rating
                      ? 'bg-mint-soft text-mint-deep'
                      : 'bg-warm-surface text-charcoal-muted'
                  }`}
                >
                  <Star className="h-4 w-4 fill-current" />
                </button>
              ))}
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-charcoal">
              <input
                type="checkbox"
                checked={feltSafe}
                onChange={(e) => setFeltSafe(e.target.checked)}
                className="h-4 w-4 accent-[#68bfa3]"
              />
              I felt safe and supported
            </label>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
              placeholder="Optional comment about the establishment's responsiveness..."
              className="neu-input-pill flex-1 px-3.5 py-2 text-sm text-charcoal focus:outline-none"
            />
            <Button
              type="button"
              size="md"
              variant="primary"
              disabled={submittingFeedback}
              onClick={() => handleSubmitFeedback(pendingFeedbackRequest.id)}
            >
              {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </div>
        </Card>
      )}

      {/* Request History */}
      <Card surface="matte" className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-charcoal">
            Assistance Request History
          </h2>
          <span className="text-xs text-charcoal-muted">{requests.length} total</span>
        </div>

        {loading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-warm-white" />
        ) : requests.length === 0 ? (
          <p className="text-sm text-charcoal-muted">
            You have not sent any assistance requests yet.
          </p>
        ) : (
          <div className="space-y-2.5">
            {requests.map((req) => (
              <div
                key={req.id}
                className="flex flex-col justify-between gap-2 rounded-2xl border border-border-soft bg-warm-white px-4 py-3.5 sm:flex-row sm:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-sm font-bold text-charcoal">
                      {req.partner_name}
                    </p>
                    <Badge tone={statusTone(req.status)}>{req.status}</Badge>
                    {req.feedback && (
                      <Badge tone="mint">Rated {req.feedback.rating}/5</Badge>
                    )}
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-charcoal-muted">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {new Date(req.created_at).toLocaleString()}
                    {req.note ? ` · "${req.note}"` : ''}
                  </p>
                </div>
                {req.partner_response_note && (
                  <p className="text-xs italic text-charcoal-muted">
                    Partner: &ldquo;{req.partner_response_note}&rdquo;
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <EmergencyBanner />
    </DashboardLayout>
  );
}
