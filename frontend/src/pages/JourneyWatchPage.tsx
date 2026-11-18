import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  MapPin,
  Navigation,
  PhoneCall,
  Plus,
  Radio,
  Search,
  ShieldCheck,
  StopCircle,
  Trash2,
  UserPlus,
} from 'lucide-react';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge, Button, Card, EmptyState, Input, Skeleton, Switch } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useGeolocation } from '@/hooks/useGeolocation';
import {
  createPinIcon,
  createUserLocationIcon,
  MAP_TILE_ATTRIBUTION,
  MAP_TILE_URL,
  MYSURU_DEFAULT_CENTER,
} from '@/lib/leaflet';
import {
  ApiError,
  cancelJourney,
  checkInJourney,
  completeJourney,
  createTrustedContact,
  deleteTrustedContact,
  fetchJourneys,
  fetchTrustedContacts,
  geoReverse,
  geoSearch,
  postJourneyLocation,
  startJourney,
  stopJourneySharing,
} from '@/services/api';
import type { GeoSearchSuggestion, JourneyItem, TrustedContactItem } from '@/types';

function DestinationPinPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function JourneyWatchPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const geo = useGeolocation();

  const [journeys, setJourneys] = useState<JourneyItem[]>([]);
  const [contacts, setContacts] = useState<TrustedContactItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // New journey form
  const [originLabel, setOriginLabel] = useState('');
  const [destQuery, setDestQuery] = useState('');
  const [destSuggestions, setDestSuggestions] = useState<GeoSearchSuggestion[]>([]);
  const [destCoords, setDestCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [etaMinutes, setEtaMinutes] = useState(30);
  const [checkinInterval, setCheckinInterval] = useState(15);
  const [enableLiveSharing, setEnableLiveSharing] = useState(
    Boolean(user?.profile?.location_sharing_default ?? true),
  );
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  // Arrival prompt (triggered when within 100 m of destination; never auto-completes)
  const [arrivalPromptVisible, setArrivalPromptVisible] = useState(false);
  const [distanceToDestM, setDistanceToDestM] = useState<number | null>(null);

  // Trusted contact form
  const [cName, setCName] = useState('');
  const [cRelation, setCRelation] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [addingContact, setAddingContact] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [jRes, cRes] = await Promise.all([fetchJourneys(), fetchTrustedContacts()]);
      setJourneys(jRes.results);
      setContacts(cRes.results);
      setSelectedContactIds((prev) =>
        prev.length ? prev : cRes.results.slice(0, 2).map((c) => c.id),
      );
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Could not load Journey Watch',
        description: err instanceof ApiError ? err.message : 'Check your connection.',
      });
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const activeJourney = useMemo(
    () =>
      journeys.find(
        (j) => j.status === 'ACTIVE' || j.status === 'MISSED' || j.status === 'OVERDUE',
      ) || null,
    [journeys],
  );

  // Debounced Nominatim destination search
  useEffect(() => {
    const trimmed = destQuery.trim();
    if (trimmed.length < 3 || destCoords) {
      setDestSuggestions([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const res = await geoSearch(trimmed, 5);
        setDestSuggestions(res.results);
      } catch {
        setDestSuggestions([]);
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [destQuery, destCoords]);

  const activeJourneyId = activeJourney?.id ?? null;
  const activeJourneySharing = Boolean(activeJourney?.location_sharing_enabled);

  // Foreground watchPosition -> POST /api/journeys/{id}/location/ every 15 seconds while active & opt-in
  useEffect(() => {
    if (!activeJourneyId || !activeJourneySharing || !geo.coords) {
      return;
    }

    const pushPing = async () => {
      if (!geo.coords) return;
      try {
        const res = await postJourneyLocation(activeJourneyId, {
          latitude: geo.coords.lat,
          longitude: geo.coords.lng,
          accuracy_m: geo.coords.accuracy,
        });
        setDistanceToDestM(res.distance_to_destination_m);
        if (res.within_arrival_radius) {
          setArrivalPromptVisible(true);
        }
        const refreshed = await fetchJourneys();
        setJourneys(refreshed.results);
      } catch {
        // Ignore transient network drops
      }
    };

    void pushPing();
    const timer = window.setInterval(() => {
      void pushPing();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [activeJourneyId, activeJourneySharing, geo.coords]);

  const handlePickDestPin = async (lat: number, lng: number) => {
    setDestCoords({ lat, lng });
    setDestSuggestions([]);
    try {
      const rev = await geoReverse(lat, lng);
      setDestQuery(rev.display_name);
    } catch {
      setDestQuery(`Pinned destination (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
    }
  };

  const handleStartJourney = async (e: FormEvent) => {
    e.preventDefault();
    if (destQuery.trim().length < 2) {
      pushToast({ tone: 'warning', title: 'Enter or pin a destination first' });
      return;
    }
    setSubmitting(true);
    try {
      const expectedArrival = new Date(Date.now() + etaMinutes * 60_000).toISOString();
      const created = await startJourney({
        origin_label: originLabel.trim() || 'Current location',
        destination_label: destQuery.trim(),
        destination_latitude: destCoords ? Number(destCoords.lat.toFixed(6)) : null,
        destination_longitude: destCoords ? Number(destCoords.lng.toFixed(6)) : null,
        expected_arrival_at: expectedArrival,
        checkin_interval_minutes: checkinInterval,
        location_sharing_enabled: enableLiveSharing,
        trusted_contact_ids: selectedContactIds,
      });
      setJourneys((prev) => [created, ...prev]);
      setArrivalPromptVisible(false);
      if (enableLiveSharing) {
        geo.startWatching();
      }
      pushToast({
        tone: 'success',
        title: 'Journey Watch started',
        description: 'Share the expiring contact link with trusted contacts if desired.',
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Could not start journey',
        description: err instanceof ApiError ? err.message : 'Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckIn = async (status: 'SAFE' | 'DELAYED') => {
    if (!activeJourney) return;
    try {
      const updated = await checkInJourney(activeJourney.id, {
        status,
        note: status === 'SAFE' ? 'Checked in safe' : 'Running a few minutes late',
        latitude: geo.coords ? Number(geo.coords.lat.toFixed(6)) : null,
        longitude: geo.coords ? Number(geo.coords.lng.toFixed(6)) : null,
      });
      setJourneys((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
      pushToast({ tone: 'success', title: `Check-in recorded (${status})` });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Check-in failed',
        description: err instanceof ApiError ? err.message : 'Please retry.',
      });
    }
  };

  const handleComplete = async () => {
    if (!activeJourney) return;
    try {
      const updated = await completeJourney(activeJourney.id);
      geo.stop();
      setArrivalPromptVisible(false);
      setJourneys((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
      pushToast({
        tone: 'success',
        title: 'Arrived safely — Journey completed',
        description: 'Share link expired and all location pings deleted.',
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Could not complete journey',
        description: err instanceof ApiError ? err.message : 'Please retry.',
      });
    }
  };

  const handleStopSharing = async (end = false, revoke = false) => {
    if (!activeJourney) return;
    try {
      const updated = end
        ? await cancelJourney(activeJourney.id)
        : await stopJourneySharing(activeJourney.id, false, revoke);
      geo.stop();
      setJourneys((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
      pushToast({
        tone: 'info',
        title: end ? 'Journey ended & pings deleted' : 'Live location sharing stopped',
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Action failed',
        description: err instanceof ApiError ? err.message : 'Please retry.',
      });
    }
  };

  const handleAddContact = async (e: FormEvent) => {
    e.preventDefault();
    if (!cName.trim() || !cPhone.trim()) return;
    setAddingContact(true);
    try {
      const created = await createTrustedContact({
        name: cName.trim(),
        relationship: cRelation.trim(),
        phone: cPhone.trim(),
        email: cEmail.trim(),
        notify_on_journey_start: true,
        notify_on_missed_checkin: true,
        notify_on_arrival: true,
        is_primary: contacts.length === 0,
      });
      setContacts((prev) => [...prev, created]);
      setSelectedContactIds((prev) => [...prev, created.id]);
      setCName('');
      setCRelation('');
      setCPhone('');
      setCEmail('');
      pushToast({ tone: 'success', title: 'Trusted contact added' });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Could not add contact',
        description: err instanceof ApiError ? err.message : 'Please check input.',
      });
    } finally {
      setAddingContact(false);
    }
  };

  const shareUrl = activeJourney?.share_token
    ? `${window.location.origin}/journey-status/${activeJourney.share_token}`
    : '';

  const liveTrail = useMemo<[number, number][]>(() => {
    if (!activeJourney?.recent_pings?.length) return [];
    return activeJourney.recent_pings.map((p) => [Number(p.latitude), Number(p.longitude)]);
  }, [activeJourney]);

  return (
    <DashboardLayout
      title="Private Journey Watch & Trusted Contacts"
      subtitle="Opt-in live travel check-ins with expiring read-only links for trusted contacts — never shown on public maps."
    >
      {/* Persistent Sharing Location Banner whenever live tracking is active */}
      {activeJourney && activeJourney.location_sharing_enabled && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-mint-dark bg-mint-soft px-4 py-3 text-xs text-mint-deep shadow-elev-1"
        >
          <div className="flex items-center gap-2 font-semibold">
            <Radio className="h-4 w-4 animate-pulse" />
            <span>
              Sharing location live for journey to <strong>{activeJourney.destination_label}</strong>.
              Keep this page open while travelling (web browsers cannot track in the background when
              the tab is closed or phone is locked).
            </span>
          </div>
          <Button
            size="sm"
            variant="danger"
            onClick={() => void handleStopSharing(false, false)}
          >
            <StopCircle className="h-3.5 w-3.5" />
            Stop Sharing
          </Button>
        </div>
      )}

      {/* Arrival Proximity Prompt (<= 100 m, requires explicit user confirmation) */}
      {activeJourney && arrivalPromptVisible && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-mint-dark bg-mint-soft/70 p-4">
          <div className="flex items-center gap-2.5 text-sm font-bold text-mint-deep">
            <CheckCircle2 className="h-5 w-5" />
            <span>
              You are within 100 m of {activeJourney.destination_label}. Have you arrived safely?
            </span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={() => void handleComplete()}>
              Yes, I Have Arrived
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setArrivalPromptVisible(false)}
            >
              Not yet
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left: Active Journey OR Start New Journey */}
          <div className="space-y-5 lg:col-span-7">
            {activeJourney ? (
              <Card className="space-y-5 p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge
                    tone={
                      activeJourney.status === 'MISSED' || activeJourney.status === 'OVERDUE'
                        ? 'error'
                        : 'mint'
                    }
                  >
                    {activeJourney.status_display}
                  </Badge>
                  <span className="text-xs text-charcoal-muted">
                    ETA: {new Date(activeJourney.expected_arrival_at).toLocaleTimeString()}
                  </span>
                </div>

                <div>
                  <h2 className="font-display text-xl font-extrabold text-charcoal">
                    {activeJourney.origin_label || 'Origin'} → {activeJourney.destination_label}
                  </h2>
                  {distanceToDestM !== null && (
                    <p className="mt-1 text-xs text-charcoal-muted tabular-nums">
                      Approx. {Math.round(distanceToDestM)} m to destination
                    </p>
                  )}
                </div>

                {(activeJourney.status === 'MISSED' || activeJourney.is_checkin_overdue) && (
                  <div className="flex items-start gap-2 rounded-control border border-[var(--color-error)] bg-[var(--color-error-soft)] p-3 text-xs text-[var(--color-error-deep)]">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Your expected check-in time passed. Tap <strong>Check In Safe</strong> now or
                      call <a href="tel:112" className="font-bold underline">112</a> if you need
                      immediate emergency assistance.
                    </span>
                  </div>
                )}

                {/* Live Own Route Map */}
                <div className="h-64 w-full overflow-hidden rounded-control border border-border-soft">
                  <MapContainer
                    center={[
                      geo.coords?.lat ??
                        Number(
                          activeJourney.last_known_latitude ??
                            activeJourney.destination_latitude ??
                            MYSURU_DEFAULT_CENTER.lat,
                        ),
                      geo.coords?.lng ??
                        Number(
                          activeJourney.last_known_longitude ??
                            activeJourney.destination_longitude ??
                            MYSURU_DEFAULT_CENTER.lng,
                        ),
                    ]}
                    zoom={14}
                    className="h-full w-full"
                  >
                    <TileLayer url={MAP_TILE_URL} attribution={MAP_TILE_ATTRIBUTION} maxZoom={19} />
                    {(geo.coords ||
                      (activeJourney.last_known_latitude &&
                        activeJourney.last_known_longitude)) && (
                      <Marker
                        position={[
                          geo.coords?.lat ?? Number(activeJourney.last_known_latitude),
                          geo.coords?.lng ?? Number(activeJourney.last_known_longitude),
                        ]}
                        icon={createUserLocationIcon()}
                      >
                        <Popup>Your current position</Popup>
                      </Marker>
                    )}
                    {activeJourney.destination_latitude && activeJourney.destination_longitude && (
                      <Marker
                        position={[
                          Number(activeJourney.destination_latitude),
                          Number(activeJourney.destination_longitude),
                        ]}
                        icon={createPinIcon()}
                      >
                        <Popup>Destination: {activeJourney.destination_label}</Popup>
                      </Marker>
                    )}
                    {liveTrail.length >= 2 && (
                      <Polyline positions={liveTrail} pathOptions={{ color: '#2563EB', weight: 4 }} />
                    )}
                  </MapContainer>
                </div>

                {/* Private Expiring Contact Link */}
                {shareUrl && activeJourney.is_share_link_valid && (
                  <div className="space-y-2 rounded-control border border-border-soft bg-warm-white p-3.5 text-xs">
                    <p className="font-bold text-charcoal">
                      Private Expiring Link for Trusted Contacts
                    </p>
                    <p className="break-all font-mono text-[11px] text-charcoal-muted">
                      {shareUrl}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          void navigator.clipboard?.writeText(shareUrl);
                          pushToast({ tone: 'success', title: 'Private status link copied' });
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy Link
                      </Button>
                      <a href={shareUrl} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="ghost" type="button">
                          <ExternalLink className="h-3.5 w-3.5" />
                          Preview Contact View
                        </Button>
                      </a>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => void handleStopSharing(false, true)}
                      >
                        Revoke Link
                      </Button>
                    </div>
                  </div>
                )}

                {/* Check-in & Completion Actions */}
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" onClick={() => void handleCheckIn('SAFE')}>
                    <ShieldCheck className="h-4 w-4" />
                    Check In Safe
                  </Button>
                  <Button variant="secondary" onClick={() => void handleCheckIn('DELAYED')}>
                    <Clock className="h-4 w-4" />
                    Running Late
                  </Button>
                  {activeJourney.location_sharing_enabled && !geo.isWatching && (
                    <Button variant="secondary" onClick={() => geo.startWatching()}>
                      <Navigation className="h-4 w-4" />
                      Resume Live GPS
                    </Button>
                  )}
                  <Button variant="primary" onClick={() => void handleComplete()}>
                    <CheckCircle2 className="h-4 w-4" />
                    Arrived Safely
                  </Button>
                  <Button variant="danger" onClick={() => void handleStopSharing(true, true)}>
                    Cancel Journey
                  </Button>
                </div>
              </Card>
            ) : (
              <Card className="space-y-4 p-6">
                <h2 className="font-display text-lg font-bold text-charcoal">
                  Start Opt-In Journey Watch
                </h2>
                <p className="text-xs text-charcoal-muted">
                  Keep this page open while travelling. Web browsers cannot run background GPS when
                  the tab is closed or the phone screen is locked.
                </p>

                <form onSubmit={handleStartJourney} className="space-y-4">
                  <Input
                    label="Starting Point (optional)"
                    value={originLabel}
                    onChange={(e) => setOriginLabel(e.target.value)}
                    placeholder="e.g. SJCE Campus Gate, Mysuru"
                  />

                  <div className="relative space-y-1.5">
                    <label
                      htmlFor="journey-dest"
                      className="block text-xs font-semibold text-charcoal"
                    >
                      Destination (search or tap on map below)
                    </label>
                    <div className="neu-input-pill flex items-center gap-2 px-3.5 py-2.5">
                      <Search className="h-4 w-4 text-charcoal-muted" />
                      <input
                        id="journey-dest"
                        type="text"
                        required
                        value={destQuery}
                        onChange={(e) => {
                          setDestQuery(e.target.value);
                          setDestCoords(null);
                        }}
                        placeholder="Search destination in India or tap the map..."
                        className="w-full bg-transparent text-sm text-charcoal focus:outline-none"
                      />
                    </div>
                    {destSuggestions.length > 0 && (
                      <ul className="absolute left-0 right-0 z-30 mt-1 max-h-48 overflow-y-auto rounded-card border border-border-soft bg-white p-1 shadow-elev-3">
                        {destSuggestions.map((s) => (
                          <li key={`${s.lat}-${s.lng}-${s.display_name}`}>
                            <button
                              type="button"
                              onClick={() => {
                                setDestQuery(s.display_name);
                                setDestCoords({ lat: s.lat, lng: s.lng });
                                setDestSuggestions([]);
                              }}
                              className="flex w-full items-start gap-2 rounded-control px-3 py-2 text-left text-xs hover:bg-mint-soft/70"
                            >
                              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-deep" />
                              <span className="line-clamp-2">{s.display_name}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Tap-to-pin destination mini-map */}
                  <div className="h-52 w-full overflow-hidden rounded-control border border-border-soft">
                    <MapContainer
                      center={[
                        destCoords?.lat ?? MYSURU_DEFAULT_CENTER.lat,
                        destCoords?.lng ?? MYSURU_DEFAULT_CENTER.lng,
                      ]}
                      zoom={13}
                      className="h-full w-full"
                    >
                      <TileLayer url={MAP_TILE_URL} attribution={MAP_TILE_ATTRIBUTION} maxZoom={19} />
                      <DestinationPinPicker onPick={(lat, lng) => void handlePickDestPin(lat, lng)} />
                      {destCoords && (
                        <Marker position={[destCoords.lat, destCoords.lng]} icon={createPinIcon()}>
                          <Popup>Destination pin</Popup>
                        </Marker>
                      )}
                    </MapContainer>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="Expected Arrival (minutes from now)"
                      type="number"
                      min={5}
                      max={360}
                      value={etaMinutes}
                      onChange={(e) => setEtaMinutes(Number(e.target.value) || 30)}
                    />
                    <Input
                      label="Check-in Interval (minutes)"
                      type="number"
                      min={5}
                      max={180}
                      value={checkinInterval}
                      onChange={(e) => setCheckinInterval(Number(e.target.value) || 15)}
                    />
                  </div>

                  <div className="rounded-control border border-mint-dark/40 bg-mint-soft/45 p-3.5">
                    <Switch
                      checked={enableLiveSharing}
                      onChange={setEnableLiveSharing}
                      label="Share live GPS while this page stays open"
                      description="Updates every 15 s and generates an expiring read-only link for selected trusted contacts."
                    />
                  </div>

                  {contacts.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-charcoal">
                        Trusted Contacts for this Journey
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {contacts.map((c) => {
                          const picked = selectedContactIds.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() =>
                                setSelectedContactIds((prev) =>
                                  picked ? prev.filter((id) => id !== c.id) : [...prev, c.id],
                                )
                              }
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                picked ? 'neu-chip-active' : 'neu-chip'
                              }`}
                            >
                              {c.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <Button type="submit" variant="primary" disabled={submitting}>
                    <Navigation className="h-4 w-4" />
                    {submitting ? 'Starting...' : 'Start Journey Watch'}
                  </Button>
                </form>
              </Card>
            )}
          </div>

          {/* Right: Trusted Contacts CRUD */}
          <div className="space-y-5 lg:col-span-5">
            <Card className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-charcoal">
                  Trusted Contacts ({contacts.length})
                </h2>
                <UserPlus className="h-4 w-4 text-mint-deep" />
              </div>

              {contacts.length === 0 ? (
                <EmptyState
                  title="No trusted contacts yet"
                  description="Add a family member or friend to receive missed check-in reminders."
                />
              ) : (
                <ul className="space-y-2.5">
                  {contacts.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-2 rounded-control border border-border-soft bg-warm-white p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-charcoal">{c.name}</p>
                        <p className="text-xs text-charcoal-muted">
                          {c.relationship ? `${c.relationship} · ` : ''}
                          {c.phone}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`tel:${c.phone}`}
                          aria-label={`Call ${c.name}`}
                          className="rounded-full p-2 text-mint-deep hover:bg-mint-soft"
                        >
                          <PhoneCall className="h-4 w-4" />
                        </a>
                        <button
                          type="button"
                          aria-label={`Remove ${c.name}`}
                          onClick={async () => {
                            await deleteTrustedContact(c.id);
                            setContacts((prev) => prev.filter((item) => item.id !== c.id));
                            pushToast({ tone: 'info', title: 'Contact removed' });
                          }}
                          className="rounded-full p-2 text-charcoal-muted hover:bg-[var(--color-error-soft)] hover:text-[var(--color-error-deep)]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <form
                onSubmit={handleAddContact}
                className="space-y-3 border-t border-border-soft pt-4"
              >
                <p className="text-xs font-bold text-charcoal">Add Trusted Contact</p>
                <Input
                  label="Name"
                  required
                  value={cName}
                  onChange={(e) => setCName(e.target.value)}
                  placeholder="e.g. Anitha Rao"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Phone"
                    required
                    value={cPhone}
                    onChange={(e) => setCPhone(e.target.value)}
                    placeholder="+91-98450-12345"
                  />
                  <Input
                    label="Relationship"
                    value={cRelation}
                    onChange={(e) => setCRelation(e.target.value)}
                    placeholder="Sister / Friend"
                  />
                </div>
                <Input
                  label="Email (optional)"
                  type="email"
                  value={cEmail}
                  onChange={(e) => setCEmail(e.target.value)}
                  placeholder="contact@example.com"
                />
                <Button size="sm" variant="secondary" type="submit" disabled={addingContact}>
                  <Plus className="h-3.5 w-3.5" />
                  {addingContact ? 'Adding...' : 'Add Trusted Contact'}
                </Button>
              </form>
            </Card>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
