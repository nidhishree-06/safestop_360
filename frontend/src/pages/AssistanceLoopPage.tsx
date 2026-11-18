import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Car,
  CheckCircle2,
  Clock,
  ExternalLink,
  Footprints,
  MapPin,
  Navigation,
  PhoneCall,
  RefreshCw,
  Send,
  ShieldCheck,
  Star,
  StopCircle,
  XCircle,
} from 'lucide-react';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  GlassCard,
  Modal,
  Skeleton,
  StatusTimeline,
  Switch,
  type TimelineStep,
} from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useGeolocation } from '@/hooks/useGeolocation';
import {
  createUserLocationIcon,
  createVerifiedPartnerIcon,
  formatDistance,
  formatDuration,
  MAP_TILE_ATTRIBUTION,
  MAP_TILE_URL,
  MYSURU_DEFAULT_CENTER,
} from '@/lib/leaflet';
import {
  ApiError,
  cancelHelpRequest,
  createHelpRequest,
  fetchHelpRequests,
  fetchNearbyPartners,
  geoRoute,
  markHelpRequestArrived,
  postHelpRequestLocation,
  stopHelpRequestSharing,
  submitHelpRequestFeedback,
} from '@/services/api';
import type { GeoRouteResponse, HelpRequestItem, HelpRequestStatus, PartnerItem } from '@/types';

const ACTIVE_STATUSES: HelpRequestStatus[] = ['PENDING', 'ACCEPTED', 'ARRIVED'];

function statusTone(
  s: HelpRequestStatus,
): 'mint' | 'warning' | 'error' | 'blue' | 'neutral' {
  if (s === 'ACCEPTED' || s === 'ARRIVED' || s === 'CLOSED') return 'mint';
  if (s === 'PENDING') return 'warning';
  if (s === 'DECLINED' || s === 'EXPIRED' || s === 'CANCELLED') return 'error';
  return 'neutral';
}

function buildSteps(req: HelpRequestItem): TimelineStep[] {
  const cancelled =
    req.status === 'CANCELLED' || req.status === 'DECLINED' || req.status === 'EXPIRED';
  return [
    {
      id: 'sent',
      label: 'Request Sent',
      detail: new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      state: 'completed',
    },
    {
      id: 'accepted',
      label: 'Partner Accepted',
      detail: req.partner_response_note || (req.status === 'PENDING' ? 'Awaiting partner confirmation (10-min auto-expiry)' : undefined),
      state:
        req.status === 'PENDING'
          ? 'current'
          : cancelled
            ? 'cancelled'
            : 'completed',
    },
    {
      id: 'arrived',
      label: 'Arrival Confirmed',
      detail: req.arrived_at
        ? new Date(req.arrived_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : undefined,
      state:
        req.status === 'ACCEPTED'
          ? 'current'
          : req.status === 'ARRIVED' || req.status === 'CLOSED'
            ? 'completed'
            : 'upcoming',
    },
    {
      id: 'closed',
      label: 'Closed & Pings Purged',
      detail: req.status === 'CLOSED' ? 'All temporary location pings deleted.' : undefined,
      state:
        req.status === 'ARRIVED'
          ? 'current'
          : req.status === 'CLOSED'
            ? 'completed'
            : 'upcoming',
    },
  ];
}

function RequestMapBounds({
  points,
}: {
  points: [number, number][];
}) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize({ animate: false });
    if (points.length >= 2) {
      map.fitBounds(points, { padding: [44, 44], maxZoom: 16 });
    } else if (points.length === 1) {
      map.setView(points[0], 15);
    }
  }, [map, points]);
  return null;
}

export function AssistanceLoopPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const geo = useGeolocation();

  const [requests, setRequests] = useState<HelpRequestItem[]>([]);
  const [partners, setPartners] = useState<PartnerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  // Quick request form
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [note, setNote] = useState(user?.profile?.emergency_note || '');
  const [shareLive, setShareLive] = useState(true);
  const [sending, setSending] = useState(false);

  // Directions for ACCEPTED request
  const [routeProfile, setRouteProfile] = useState<'foot' | 'driving'>('foot');
  const [routeData, setRouteData] = useState<GeoRouteResponse | null>(null);

  // Feedback modal
  const [feedbackReq, setFeedbackReq] = useState<HelpRequestItem | null>(null);
  const [rating, setRating] = useState(5);
  const [feltSafe, setFeltSafe] = useState(true);
  const [comment, setComment] = useState('');
  const [savingFeedback, setSavingFeedback] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [reqRes, partRes] = await Promise.all([
        fetchHelpRequests(),
        fetchNearbyPartners({
          lat: geo.coords?.lat ?? MYSURU_DEFAULT_CENTER.lat,
          lng: geo.coords?.lng ?? MYSURU_DEFAULT_CENTER.lng,
          radius_km: 15,
          available_only: true,
        }),
      ]);
      setRequests(reqRes.results);
      setPartners(partRes.results);
      setSelectedPartnerId((prev) => prev || partRes.results[0]?.id || '');
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Could not refresh requests',
        description: err instanceof ApiError ? err.message : 'Check your connection.',
      });
    } finally {
      setLoading(false);
    }
  }, [geo.coords?.lat, geo.coords?.lng, pushToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeRequest = useMemo(
    () => requests.find((r) => ACTIVE_STATUSES.includes(r.status)) || null,
    [requests],
  );
  const pastRequests = useMemo(
    () => requests.filter((r) => !ACTIVE_STATUSES.includes(r.status)),
    [requests],
  );

  // Poll every 5 s while an active request exists
  useEffect(() => {
    if (!activeRequest) return;
    const id = window.setInterval(() => {
      void fetchHelpRequests()
        .then((res) => setRequests(res.results))
        .catch(() => {});
    }, 5000);
    return () => window.clearInterval(id);
  }, [activeRequest]);

  // Send live GPS pings every 12 s while ACCEPTED & share_live_location is enabled
  useEffect(() => {
    if (
      !activeRequest ||
      !activeRequest.share_live_location ||
      (activeRequest.status !== 'PENDING' && activeRequest.status !== 'ACCEPTED') ||
      !geo.coords
    ) {
      return;
    }

    const sendPing = () => {
      if (!geo.coords) return;
      void postHelpRequestLocation(activeRequest.id, {
        latitude: geo.coords.lat,
        longitude: geo.coords.lng,
        accuracy_m: geo.coords.accuracy,
      }).catch(() => {});
    };

    sendPing();
    const interval = window.setInterval(sendPing, 12000);
    return () => window.clearInterval(interval);
  }, [activeRequest, geo.coords]);

  // Fetch OSRM route once request is ACCEPTED
  useEffect(() => {
    if (!activeRequest || activeRequest.status !== 'ACCEPTED') {
      setRouteData(null);
      return;
    }
    const fromLat = geo.coords?.lat ?? Number(activeRequest.requester_latitude ?? MYSURU_DEFAULT_CENTER.lat);
    const fromLng = geo.coords?.lng ?? Number(activeRequest.requester_longitude ?? MYSURU_DEFAULT_CENTER.lng);
    const toLat = Number(activeRequest.partner_latitude);
    const toLng = Number(activeRequest.partner_longitude);

    void geoRoute({ fromLat, fromLng, toLat, toLng, profile: routeProfile })
      .then(setRouteData)
      .catch(() => setRouteData(null));
  }, [activeRequest, geo.coords, routeProfile]);

  const handleCreate = async () => {
    if (!selectedPartnerId) return;
    setSending(true);
    try {
      const created = await createHelpRequest({
        partner: selectedPartnerId,
        note: note.trim(),
        share_live_location: shareLive,
        requester_latitude: shareLive && geo.coords ? Number(geo.coords.lat.toFixed(6)) : null,
        requester_longitude: shareLive && geo.coords ? Number(geo.coords.lng.toFixed(6)) : null,
      });
      setRequests((prev) => [created, ...prev]);
      pushToast({
        tone: 'success',
        title: 'Help request sent',
        description: `Waiting for ${created.partner_name} to accept.`,
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Unable to send request',
        description: err instanceof ApiError ? err.message : 'Please try again.',
      });
    } finally {
      setSending(false);
    }
  };

  const handleConfirmArrival = async (id: string) => {
    setActing(true);
    try {
      const updated = await markHelpRequestArrived(id);
      setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
      geo.stop();
      pushToast({
        tone: 'success',
        title: 'Arrival confirmed',
        description: 'The partner can now close the request safely.',
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Action failed',
        description: err instanceof ApiError ? err.message : 'Could not update status.',
      });
    } finally {
      setActing(false);
    }
  };

  const handleCancel = async (id: string) => {
    setActing(true);
    try {
      const updated = await cancelHelpRequest(id);
      setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
      geo.stop();
      pushToast({
        tone: 'info',
        title: 'Request cancelled',
        description: 'All temporary location pings for this request have been deleted.',
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Cancel failed',
        description: err instanceof ApiError ? err.message : 'Could not cancel request.',
      });
    } finally {
      setActing(false);
    }
  };

  const handleStopSharing = async (id: string) => {
    setActing(true);
    try {
      const updated = await stopHelpRequestSharing(id);
      setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
      geo.stop();
      pushToast({
        tone: 'info',
        title: 'Location sharing stopped',
        description: 'The partner now sees "Location sharing stopped" and all pings were deleted.',
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Could not stop sharing',
        description: err instanceof ApiError ? err.message : 'Please retry.',
      });
    } finally {
      setActing(false);
    }
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackReq) return;
    setSavingFeedback(true);
    try {
      const fb = await submitHelpRequestFeedback(feedbackReq.id, {
        rating,
        felt_safe: feltSafe,
        comment: comment.trim(),
      });
      setRequests((prev) =>
        prev.map((r) => (r.id === feedbackReq.id ? { ...r, feedback: fb } : r)),
      );
      setFeedbackReq(null);
      setComment('');
      pushToast({ tone: 'success', title: 'Thank you for your feedback' });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Could not submit feedback',
        description: err instanceof ApiError ? err.message : 'Please try again.',
      });
    } finally {
      setSavingFeedback(false);
    }
  };

  const mapPoints = useMemo<[number, number][]>(() => {
    if (!activeRequest) return [];
    const pts: [number, number][] = [
      [Number(activeRequest.partner_latitude), Number(activeRequest.partner_longitude)],
    ];
    if (geo.coords) {
      pts.push([geo.coords.lat, geo.coords.lng]);
    } else if (activeRequest.requester_latitude && activeRequest.requester_longitude) {
      pts.push([
        Number(activeRequest.requester_latitude),
        Number(activeRequest.requester_longitude),
      ]);
    }
    return pts;
  }, [activeRequest, geo.coords]);

  const routePositions = useMemo<[number, number][]>(() => {
    if (!routeData?.geometry?.coordinates?.length) return [];
    return routeData.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  }, [routeData]);

  return (
    <DashboardLayout
      title="Assistance Confirmation Loop"
      subtitle="Send a discreet request to a verified SafePlace, share live location strictly by opt-in consent, and confirm arrival."
    >
      {loading ? (
        <Card className="space-y-3 p-6">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-44 w-full" />
        </Card>
      ) : activeRequest ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeRequest.status}
            initial={{ opacity: 0, y: 14, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28 }}
            className="grid gap-6 lg:grid-cols-12"
          >
            {/* Status & Controls Panel */}
            <Card
              surface={activeRequest.status === 'ACCEPTED' ? 'glass-3d' : 'matte'}
              className="space-y-5 p-6 lg:col-span-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge tone={statusTone(activeRequest.status)}>
                  {activeRequest.status_display}
                </Badge>
                {activeRequest.partner_is_demo && <Badge tone="violet">Demo</Badge>}
                <button
                  type="button"
                  onClick={() => void loadData()}
                  aria-label="Refresh request status"
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-charcoal-muted hover:bg-warm-surface"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Live polling
                </button>
              </div>

              <div>
                <h2 className="font-display text-xl font-extrabold text-charcoal">
                  {activeRequest.partner_name}
                </h2>
                <p className="mt-0.5 text-xs text-charcoal-muted">
                  {activeRequest.partner_category} · {activeRequest.partner_address}
                </p>
                {activeRequest.partner_response_note && (
                  <div className="mt-3 rounded-control border border-mint-dark/40 bg-mint-soft/70 p-3 text-xs text-mint-deep">
                    <strong>Partner note:</strong> {activeRequest.partner_response_note}
                  </div>
                )}
              </div>

              <StatusTimeline steps={buildSteps(activeRequest)} />

              {/* Live Location Consent Controls */}
              <div className="rounded-control border border-border-soft bg-white/90 p-3.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-charcoal">Live location sharing</span>
                  <Badge tone={activeRequest.share_live_location ? 'blue' : 'neutral'}>
                    {activeRequest.share_live_location
                      ? activeRequest.status === 'ACCEPTED'
                        ? 'Active with partner'
                        : 'Armed (shared after Accept)'
                      : 'Stopped'}
                  </Badge>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {activeRequest.share_live_location && !geo.isWatching && (
                    <Button size="sm" variant="secondary" onClick={() => geo.startWatching()}>
                      <MapPin className="h-3.5 w-3.5" />
                      Send live GPS updates
                    </Button>
                  )}
                  {activeRequest.share_live_location && (
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={acting}
                      onClick={() => void handleStopSharing(activeRequest.id)}
                    >
                      <StopCircle className="h-3.5 w-3.5" />
                      Stop sharing
                    </Button>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-1">
                {activeRequest.status === 'ACCEPTED' && (
                  <Button
                    variant="primary"
                    disabled={acting}
                    onClick={() => void handleConfirmArrival(activeRequest.id)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    I Have Arrived Safely
                  </Button>
                )}
                {(activeRequest.status === 'PENDING' || activeRequest.status === 'ACCEPTED') && (
                  <Button
                    variant="danger"
                    disabled={acting}
                    onClick={() => void handleCancel(activeRequest.id)}
                  >
                    <XCircle className="h-4 w-4" />
                    Cancel Request
                  </Button>
                )}
                <a href={`tel:${activeRequest.partner_phone}`}>
                  <Button variant="secondary" type="button">
                    <PhoneCall className="h-4 w-4" />
                    Call Desk
                  </Button>
                </a>
              </div>
            </Card>

            {/* Live Map: Pulsing Pending Partner -> Route Draw on ACCEPTED */}
            <div className="relative overflow-hidden rounded-card border border-border-soft bg-white shadow-elev-2 lg:col-span-7">
              <div className="h-[440px] w-full">
                <MapContainer
                  center={[
                    Number(activeRequest.partner_latitude),
                    Number(activeRequest.partner_longitude),
                  ]}
                  zoom={15}
                  className="h-full w-full"
                >
                  <TileLayer url={MAP_TILE_URL} attribution={MAP_TILE_ATTRIBUTION} maxZoom={19} />
                  <RequestMapBounds points={mapPoints} />

                  <Marker
                    position={[
                      Number(activeRequest.partner_latitude),
                      Number(activeRequest.partner_longitude),
                    ]}
                    icon={createVerifiedPartnerIcon(
                      'OTHER',
                      true,
                      activeRequest.status === 'PENDING',
                    )}
                  >
                    <Popup>
                      <strong>{activeRequest.partner_name}</strong>
                      <br />
                      {activeRequest.partner_address}
                    </Popup>
                  </Marker>

                  {(geo.coords ||
                    (activeRequest.requester_latitude && activeRequest.requester_longitude)) && (
                    <Marker
                      position={[
                        geo.coords?.lat ?? Number(activeRequest.requester_latitude),
                        geo.coords?.lng ?? Number(activeRequest.requester_longitude),
                      ]}
                      icon={createUserLocationIcon()}
                    >
                      <Popup>Your location</Popup>
                    </Marker>
                  )}

                  {routePositions.length >= 2 && (
                    <Polyline
                      positions={routePositions}
                      pathOptions={
                        routeData?.fallback
                          ? { color: '#9A7BEA', weight: 4, dashArray: '8 8' }
                          : { color: '#1A5C47', weight: 5 }
                      }
                    />
                  )}
                </MapContainer>
              </div>

              {/* Directions Overlay after ACCEPTED */}
              {activeRequest.status === 'ACCEPTED' && routeData && (
                <div className="absolute inset-x-3 bottom-3 z-[400]">
                  <GlassCard className="p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-mint-deep">
                          Partner Confirmed — Route Ready
                        </p>
                        <p className="text-sm font-extrabold text-charcoal tabular-nums">
                          {formatDistance(routeData.distance_m)},{' '}
                          {formatDuration(routeData.duration_s, routeData.profile)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setRouteProfile('foot')}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            routeProfile === 'foot'
                              ? 'bg-mint text-mint-deep'
                              : 'bg-white text-charcoal-muted'
                          }`}
                        >
                          <Footprints className="h-3.5 w-3.5" />
                          Walk
                        </button>
                        <button
                          type="button"
                          onClick={() => setRouteProfile('driving')}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            routeProfile === 'driving'
                              ? 'bg-mint text-mint-deep'
                              : 'bg-white text-charcoal-muted'
                          }`}
                        >
                          <Car className="h-3.5 w-3.5" />
                          Drive
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <a
                        href={routeData.google_maps_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-charcoal ring-1 ring-border-soft"
                      >
                        Google Maps <ExternalLink className="h-3 w-3" />
                      </a>
                      <a
                        href={routeData.osm_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-charcoal ring-1 ring-border-soft"
                      >
                        OpenStreetMap <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </GlassCard>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      ) : (
        /* New Request Form */
        <Card className="space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-bold text-charcoal">
                Send a New Assistance Request
              </h2>
              <p className="text-xs text-charcoal-muted">
                Choose an available verified partner below or pick directly on the interactive map.
              </p>
            </div>
            <Link to="/app/map">
              <Button size="sm" variant="secondary">
                <Navigation className="h-3.5 w-3.5" />
                Pick on Map
              </Button>
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="partner-select" className="block text-xs font-semibold text-charcoal">
                Verified Available SafePlace
              </label>
              <select
                id="partner-select"
                value={selectedPartnerId}
                onChange={(e) => setSelectedPartnerId(e.target.value)}
                className="neu-input-pill w-full px-3.5 py-2.5 text-sm text-charcoal"
              >
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.category_display}
                    {typeof p.distance_km === 'number' ? ` · ${p.distance_km.toFixed(1)} km` : ''})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void geo.requestLocation()}
              >
                <MapPin className="h-4 w-4" />
                {geo.coords
                  ? `GPS Ready (within ${geo.coords.accuracy} m)`
                  : 'Attach Current GPS (optional)'}
              </Button>
            </div>
          </div>

          <div className="rounded-control border border-mint-dark/40 bg-mint-soft/45 p-3.5">
            <Switch
              checked={shareLive}
              onChange={setShareLive}
              label="Share my live location with this place until the request closes"
              description="Visible to the partner ONLY after they accept. Deleted automatically when closed, cancelled, declined, or expired."
            />
          </div>

          <textarea
            rows={2}
            maxLength={320}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note for the SafeStop desk..."
            className="neu-input-pill w-full px-3.5 py-2.5 text-sm text-charcoal focus:outline-none"
          />

          <Button
            variant="primary"
            disabled={sending || !selectedPartnerId}
            onClick={handleCreate}
          >
            <Send className="h-4 w-4" />
            {sending ? 'Sending...' : 'Send Assistance Request'}
          </Button>
        </Card>
      )}

      {/* Past Requests History */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-charcoal">
          Request History ({pastRequests.length})
        </h2>
        {pastRequests.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="h-5 w-5" />}
            title="No completed requests yet"
            description="Completed, cancelled, or expired requests will appear here with optional feedback."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {pastRequests.map((item) => (
              <Card key={item.id} className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone={statusTone(item.status)}>{item.status_display}</Badge>
                  <span className="inline-flex items-center gap-1 text-xs text-charcoal-muted">
                    <Clock className="h-3 w-3" />
                    {new Date(item.created_at).toLocaleString()}
                  </span>
                </div>
                <h3 className="font-display text-sm font-bold text-charcoal">
                  {item.partner_name}
                </h3>
                {item.partner_response_note && (
                  <p className="text-xs text-charcoal-muted">
                    Desk note: {item.partner_response_note}
                  </p>
                )}
                {item.status === 'CLOSED' && !item.feedback && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setFeedbackReq(item);
                      setRating(5);
                      setFeltSafe(true);
                    }}
                  >
                    <Star className="h-3.5 w-3.5" />
                    Leave Feedback
                  </Button>
                )}
                {item.feedback && (
                  <p className="text-xs font-semibold text-mint-deep">
                    Rated {item.feedback.rating}/5 ·{' '}
                    {item.feedback.felt_safe ? 'Felt safe' : 'Flagged for follow-up'}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={feedbackReq !== null}
        onClose={() => setFeedbackReq(null)}
        title={`Feedback for ${feedbackReq?.partner_name || ''}`}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                aria-label={`Rate ${star} out of 5`}
                onClick={() => setRating(star)}
                className={`rounded-full p-2 ${
                  star <= rating ? 'bg-mint text-mint-deep' : 'bg-warm-surface text-charcoal-muted'
                }`}
              >
                <Star className="h-4 w-4 fill-current" />
              </button>
            ))}
          </div>
          <Switch
            checked={feltSafe}
            onChange={setFeltSafe}
            label="I felt safe and supported at this SafeStop"
          />
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional feedback..."
            className="neu-input-pill w-full px-3.5 py-2.5 text-sm text-charcoal"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setFeedbackReq(null)}>
              Cancel
            </Button>
            <Button disabled={savingFeedback} onClick={handleFeedbackSubmit}>
              {savingFeedback ? 'Saving...' : 'Save Feedback'}
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
