import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import {
  Building2,
  CheckCircle2,
  Clock,
  MapPin,
  Radio,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge, Button, Card, EmptyState, Skeleton } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import {
  createUserLocationIcon,
  createVerifiedPartnerIcon,
  MAP_TILE_ATTRIBUTION,
  MAP_TILE_URL,
} from '@/lib/leaflet';
import {
  acceptHelpRequest,
  ApiError,
  closeHelpRequest,
  declineHelpRequest,
  fetchHelpRequests,
  fetchMyPartners,
  updatePartnerAvailability,
} from '@/services/api';
import type {
  HelpRequestItem,
  PartnerAvailabilityStatus,
  PartnerOwnerItem,
} from '@/types';

const STATUS_OPTIONS: Array<{ value: PartnerAvailabilityStatus; label: string }> = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'BUSY', label: 'Busy' },
  { value: 'OFFLINE', label: 'Offline' },
];

export function PartnerDashboardPage() {
  const { pushToast } = useToast();
  const [partners, setPartners] = useState<PartnerOwnerItem[]>([]);
  const [requests, setRequests] = useState<HelpRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notesByReq, setNotesByReq] = useState<Record<string, string>>({});

  const loadAll = useCallback(async () => {
    try {
      const [pRes, rRes] = await Promise.all([fetchMyPartners(), fetchHelpRequests()]);
      setPartners(pRes.results);
      setRequests(rRes.results);
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Could not load partner dashboard',
        description: err instanceof ApiError ? err.message : 'Check your connection.',
      });
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Poll every 10 s for incoming requests & live accepted requester pings
  useEffect(() => {
    const id = window.setInterval(() => {
      void fetchHelpRequests()
        .then((res) => setRequests(res.results))
        .catch(() => {});
    }, 10000);
    return () => window.clearInterval(id);
  }, []);

  const handleAvailability = async (partner: PartnerOwnerItem, next: PartnerAvailabilityStatus) => {
    setBusyId(partner.id);
    try {
      const res = await updatePartnerAvailability(partner.id, next);
      setPartners((prev) =>
        prev.map((p) => (p.id === partner.id ? { ...p, availability: res.availability } : p)),
      );
      pushToast({
        tone: 'success',
        title: `${partner.name} set to ${next}`,
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Could not update availability',
        description: err instanceof ApiError ? err.message : 'Please retry.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleRequestAction = async (
    reqId: string,
    action: 'accept' | 'decline' | 'close',
  ) => {
    setBusyId(reqId);
    const note = notesByReq[reqId] || '';
    try {
      const updated =
        action === 'accept'
          ? await acceptHelpRequest(reqId, note)
          : action === 'decline'
            ? await declineHelpRequest(reqId, note)
            : await closeHelpRequest(reqId, note);
      setRequests((prev) => prev.map((r) => (r.id === reqId ? updated : r)));
      pushToast({
        tone: 'success',
        title: `Request ${updated.status_display}`,
        description:
          action === 'close'
            ? 'Session closed and all requester location pings deleted.'
            : undefined,
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Action failed',
        description: err instanceof ApiError ? err.message : 'Please retry.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const approvedPartners = partners.filter((p) => p.verification_status === 'APPROVED');
  const pendingPartners = partners.filter((p) => p.verification_status === 'PENDING');
  const activeRequests = requests.filter((r) =>
    ['PENDING', 'ACCEPTED', 'ARRIVED'].includes(r.status),
  );
  const pastRequests = requests.filter(
    (r) => !['PENDING', 'ACCEPTED', 'ARRIVED'].includes(r.status),
  );

  return (
    <DashboardLayout
      title="Partner Operations Console"
      subtitle="Manage SafePlace availability, respond to incoming help requests, and monitor accepted live arrivals."
    >
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : partners.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="Register your SafeStop establishment"
          description="Submit your business address, map pin, and contact desk details. Once approved by an administrator, you will appear on the verified map."
          action={
            <Link to="/partner/establishment">
              <Button>Set Up Establishment Location</Button>
            </Link>
          }
        />
      ) : approvedPartners.length === 0 && pendingPartners.length > 0 ? (
        /* Dedicated Pending-Approval Screen */
        <Card className="space-y-4 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-warning-soft)] text-[var(--color-warning-deep)]">
            <Clock className="h-7 w-7" />
          </div>
          <Badge tone="warning">Pending Administrator Approval</Badge>
          <h2 className="font-display text-2xl font-extrabold text-charcoal">
            Your establishment is under verification review
          </h2>
          <p className="mx-auto max-w-lg text-sm text-charcoal-muted">
            SafeStop 360 manually verifies every partner before listing them on the public map or
            enabling incoming help requests.
          </p>
          <div className="mx-auto max-w-md space-y-2 text-left">
            {pendingPartners.map((p) => (
              <div
                key={p.id}
                className="rounded-control border border-border-soft bg-warm-white p-3.5 text-xs"
              >
                <p className="font-bold text-charcoal">{p.name}</p>
                <p className="text-charcoal-muted">{p.address}</p>
              </div>
            ))}
          </div>
          <div className="pt-2">
            <Link to="/partner/establishment">
              <Button variant="secondary">Review or Update Location Details</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Establishment Availability Controls */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-charcoal">
                My Verified Establishments ({approvedPartners.length})
              </h2>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => void loadAll()}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </Button>
                <Link to="/partner/establishment">
                  <Button size="sm" variant="secondary">
                    Manage Locations
                  </Button>
                </Link>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {partners.map((partner) => {
                const current = partner.availability?.status || 'OFFLINE';
                const approved = partner.verification_status === 'APPROVED';
                return (
                  <Card key={partner.id} className="space-y-3 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Badge tone={approved ? 'mint' : 'warning'}>
                          {partner.verification_status_display || partner.verification_status}
                        </Badge>
                        {partner.is_demo && <Badge tone="violet">Demo</Badge>}
                      </div>
                      <span className="text-xs text-charcoal-muted">
                        {partner.category_display}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-display text-base font-bold text-charcoal">
                        {partner.name}
                      </h3>
                      <p className="text-xs text-charcoal-muted">{partner.address}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {STATUS_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={!approved || busyId === partner.id}
                          onClick={() => void handleAvailability(partner, opt.value)}
                          className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors disabled:opacity-45 ${
                            current === opt.value
                              ? opt.value === 'AVAILABLE'
                                ? 'bg-mint text-mint-deep'
                                : opt.value === 'BUSY'
                                  ? 'bg-[var(--color-warning)] text-[var(--color-warning-deep)]'
                                  : 'bg-charcoal text-white'
                              : 'bg-warm-surface text-charcoal-muted hover:text-charcoal'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* Active Incoming Requests */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-charcoal">
              Incoming &amp; Active Requests ({activeRequests.length})
            </h2>
            {activeRequests.length === 0 ? (
              <EmptyState
                icon={<ShieldCheck className="h-5 w-5" />}
                title="No active requests right now"
                description="Incoming assistance requests will appear here automatically (refreshed every 10 seconds)."
              />
            ) : (
              <div className="space-y-4">
                {activeRequests.map((req) => (
                  <Card key={req.id} className="space-y-4 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={req.status === 'PENDING' ? 'warning' : 'mint'}>
                            {req.status_display}
                          </Badge>
                          <span className="text-xs text-charcoal-muted">
                            {new Date(req.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        <h3 className="mt-2 font-display text-base font-bold text-charcoal">
                          {req.requester_name || 'SafeStop User'} → {req.partner_name}
                        </h3>
                        {req.note && (
                          <p className="mt-1 text-sm text-charcoal-muted">Note: {req.note}</p>
                        )}
                      </div>
                    </div>

                    {/* Approximate live requester position map — ONLY after ACCEPTED */}
                    {req.status === 'ACCEPTED' && (
                      <div className="rounded-control border border-border-soft bg-warm-white p-3.5">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-charcoal">
                            <Radio className="h-3.5 w-3.5 text-mint-deep" />
                            Requester Approximate Position
                          </span>
                          <Badge tone={req.latest_location ? 'blue' : 'neutral'}>
                            {req.latest_location
                              ? `Updated ${new Date(req.latest_location.updated_at).toLocaleTimeString()}`
                              : 'Location sharing stopped'}
                          </Badge>
                        </div>
                        {req.latest_location ? (
                          <div className="h-52 w-full overflow-hidden rounded-control border border-border-soft">
                            <MapContainer
                              center={[req.latest_location.lat, req.latest_location.lng]}
                              zoom={15}
                              className="h-full w-full"
                            >
                              <TileLayer
                                url={MAP_TILE_URL}
                                attribution={MAP_TILE_ATTRIBUTION}
                                maxZoom={19}
                              />
                              <Marker
                                position={[req.latest_location.lat, req.latest_location.lng]}
                                icon={createUserLocationIcon()}
                              >
                                <Popup>Requester approximate location</Popup>
                              </Marker>
                              <Marker
                                position={[
                                  Number(req.partner_latitude),
                                  Number(req.partner_longitude),
                                ]}
                                icon={createVerifiedPartnerIcon('OTHER', true)}
                              >
                                <Popup>{req.partner_name}</Popup>
                              </Marker>
                            </MapContainer>
                          </div>
                        ) : (
                          <p className="text-xs text-charcoal-muted">
                            <MapPin className="mr-1 inline h-3.5 w-3.5" />
                            Location sharing stopped (or not opted in). Wait at your reception desk
                            until arrival is confirmed.
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        placeholder="Optional response note (e.g. Front desk is open for you)"
                        value={notesByReq[req.id] || ''}
                        onChange={(e) =>
                          setNotesByReq((prev) => ({ ...prev, [req.id]: e.target.value }))
                        }
                        className="neu-input-pill min-w-[220px] flex-1 px-3.5 py-2 text-xs text-charcoal"
                      />
                      {req.status === 'PENDING' && (
                        <>
                          <Button
                            size="sm"
                            variant="primary"
                            disabled={busyId === req.id}
                            onClick={() => void handleRequestAction(req.id, 'accept')}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={busyId === req.id}
                            onClick={() => void handleRequestAction(req.id, 'decline')}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Decline
                          </Button>
                        </>
                      )}
                      {req.status === 'ARRIVED' && (
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={busyId === req.id}
                          onClick={() => void handleRequestAction(req.id, 'close')}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Close Request Safely
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Past History */}
          {pastRequests.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-charcoal">
                Past Requests ({pastRequests.length})
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {pastRequests.slice(0, 8).map((req) => (
                  <Card key={req.id} surface="matte-subtle" className="p-4 text-xs">
                    <div className="flex items-center justify-between">
                      <Badge tone={req.status === 'CLOSED' ? 'mint' : 'neutral'}>
                        {req.status_display}
                      </Badge>
                      <span className="text-charcoal-muted">
                        {new Date(req.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-2 font-bold text-charcoal">
                      {req.requester_name} · {req.partner_name}
                    </p>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
