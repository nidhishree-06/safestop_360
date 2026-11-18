import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet.markercluster';
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  Compass,
  Crosshair,
  ExternalLink,
  Footprints,
  Layers,
  Loader2,
  MapPin,
  Navigation,
  PhoneCall,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  StopCircle,
  X,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  GlassCard,
  Modal,
  Skeleton,
  Switch,
} from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  readSessionLocation,
  saveSessionLocation,
  useGeolocation,
} from '@/hooks/useGeolocation';
import {
  createOsmUnverifiedIcon,
  createPinIcon,
  createUserLocationIcon,
  createVerifiedPartnerIcon,
  formatDistance,
  formatDuration,
  MAP_TILE_ATTRIBUTION,
  MAP_TILE_URL,
  MYSURU_DEFAULT_CENTER,
  MYSURU_DEFAULT_ZOOM,
} from '@/lib/leaflet';
import {
  ApiError,
  createHelpRequest,
  fetchNearbyPartners,
  geoNearbyPlaces,
  geoReverse,
  geoRoute,
  geoSearch,
} from '@/services/api';
import type {
  GeoRouteResponse,
  GeoSearchSuggestion,
  OsmPlaceItem,
  PartnerCategory,
  PartnerItem,
} from '@/types';

const CATEGORIES: Array<{ value: 'ALL' | PartnerCategory; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'PHARMACY', label: 'Pharmacy' },
  { value: 'HOSPITAL', label: 'Hospital' },
  { value: 'PETROL_STATION', label: 'Petrol' },
  { value: 'SHOP', label: 'Shop' },
  { value: 'HOTEL', label: 'Hotel' },
  { value: 'COLLEGE_FACILITY', label: 'College' },
];

const RADIUS_OPTIONS = [1, 2, 5, 10] as const;

interface ActiveOrigin {
  lat: number;
  lng: number;
  label: string;
  source: 'default' | 'gps' | 'search' | 'pin';
  accuracy?: number;
}

interface RouteTarget {
  id: string;
  name: string;
  lat: number;
  lng: number;
  verified: boolean;
}

/** Ensures Leaflet recalculates tiles on mount, resize, and layout shifts */
function MapLifecycleController({
  flyTarget,
  routeBounds,
  invalidateSignal,
  pinMode,
  onMapPin,
}: {
  flyTarget: { lat: number; lng: number; zoom?: number; seq: number } | null;
  routeBounds: [[number, number], [number, number]] | null;
  invalidateSignal: number;
  pinMode: boolean;
  onMapPin: (lat: number, lng: number) => void;
}) {
  const map = useMap();

  useEffect(() => {
    const refresh = () => map.invalidateSize({ animate: false });
    const t1 = window.setTimeout(refresh, 120);
    window.addEventListener('resize', refresh);
    return () => {
      window.clearTimeout(t1);
      window.removeEventListener('resize', refresh);
    };
  }, [map, invalidateSignal]);

  useEffect(() => {
    if (!flyTarget) return;
    map.flyTo([flyTarget.lat, flyTarget.lng], flyTarget.zoom ?? Math.max(map.getZoom(), 15), {
      duration: 0.75,
    });
  }, [flyTarget, map]);

  useEffect(() => {
    if (!routeBounds) return;
    map.fitBounds(routeBounds, { padding: [48, 48], maxZoom: 16 });
  }, [routeBounds, map]);

  useMapEvents({
    click(e) {
      if (pinMode) {
        onMapPin(e.latlng.lat, e.latlng.lng);
      }
    },
  });

  return null;
}

/** Clusters large sets (>40) of OSM markers cleanly via leaflet.markercluster */
function ClusteredOsmLayer({
  places,
  selectedId,
  onSelect,
  onDirections,
}: {
  places: OsmPlaceItem[];
  selectedId: string | null;
  onSelect: (place: OsmPlaceItem) => void;
  onDirections: (place: OsmPlaceItem) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (places.length <= 40) return;
    const clusterGroup = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 48,
    });

    places.forEach((place) => {
      const marker = L.marker([place.latitude, place.longitude], {
        icon: createOsmUnverifiedIcon(place.category, selectedId === place.id),
      });
      marker.bindPopup(
        `<div style="min-width:190px">
          <div style="font-size:10px;font-weight:700;color:#6A6E73;text-transform:uppercase;">OpenStreetMap listing · Not verified</div>
          <div style="font-weight:700;margin-top:2px;color:#22252A;">${place.name}</div>
          <div style="font-size:12px;color:#5A5E63;margin-top:2px;">${place.category_display} · ${place.distance_km} km</div>
        </div>`,
      );
      marker.on('click', () => {
        onSelect(place);
      });
      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);
    return () => {
      map.removeLayer(clusterGroup);
    };
  }, [map, places, selectedId, onSelect, onDirections]);

  if (places.length > 40) return null;

  return (
    <>
      {places.map((place) => (
        <Marker
          key={place.id}
          position={[place.latitude, place.longitude]}
          icon={createOsmUnverifiedIcon(place.category, selectedId === place.id)}
          eventHandlers={{
            click: () => onSelect(place),
          }}
        >
          <Popup>
            <div className="min-w-[200px] space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-charcoal-muted">
                OpenStreetMap listing, not verified by SafeStop
              </p>
              <p className="font-display text-sm font-bold text-charcoal">{place.name}</p>
              <p className="text-xs text-charcoal-muted">
                {place.category_display} · {place.distance_km.toFixed(2)} km away
              </p>
              <p className="text-xs text-charcoal-muted">{place.address}</p>
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={() => onDirections(place)}
              >
                <Navigation className="h-3.5 w-3.5" />
                Get Directions
              </Button>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

export function SafeStopMap({
  pendingPartnerId = null,
}: {
  pendingPartnerId?: string | null;
}) {
  const { user, isAuthenticated } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();

  const geo = useGeolocation();

  const [origin, setOrigin] = useState<ActiveOrigin>(() => {
    const saved = readSessionLocation();
    if (saved) {
      return {
        lat: saved.lat,
        lng: saved.lng,
        label: saved.label || 'Saved session location',
        source: 'pin',
      };
    }
    return {
      lat: MYSURU_DEFAULT_CENTER.lat,
      lng: MYSURU_DEFAULT_CENTER.lng,
      label: 'Mysuru City Center (default until location is set)',
      source: 'default',
    };
  });

  const [category, setCategory] = useState<'ALL' | PartnerCategory>('ALL');
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [availableOnly, setAvailableOnly] = useState(false);

  const [partners, setPartners] = useState<PartnerItem[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(true);
  const [partnersError, setPartnersError] = useState<string | null>(null);

  const [showOsmLayer, setShowOsmLayer] = useState(false);
  const [osmPlaces, setOsmPlaces] = useState<OsmPlaceItem[]>([]);
  const [loadingOsm, setLoadingOsm] = useState(false);
  const [osmUnavailable, setOsmUnavailable] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<{
    lat: number;
    lng: number;
    zoom?: number;
    seq: number;
  } | null>(null);
  const [invalidateSignal, setInvalidateSignal] = useState(0);

  // Manual search + pin drop
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<GeoSearchSuggestion[]>([]);
  const [searchingGeo, setSearchingGeo] = useState(false);
  const [searchUnavailable, setSearchUnavailable] = useState(false);
  const [pinMode, setPinMode] = useState(false);

  // Directions & routing state
  const [routeTarget, setRouteTarget] = useState<RouteTarget | null>(null);
  const [routeProfile, setRouteProfile] = useState<'foot' | 'driving'>('foot');
  const [routeData, setRouteData] = useState<GeoRouteResponse | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);

  // Send Help Request modal state
  const [requestPartner, setRequestPartner] = useState<PartnerItem | null>(null);
  const [requestNote, setRequestNote] = useState('');
  const [shareLiveLocation, setShareLiveLocation] = useState(true);
  const [sendingRequest, setSendingRequest] = useState(false);

  const markerRefs = useRef<Record<string, L.Marker | null>>({});
  const listRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Sync live GPS coordinates into origin whenever geolocation updates
  useEffect(() => {
    if (!geo.coords) return;
    setOrigin({
      lat: geo.coords.lat,
      lng: geo.coords.lng,
      label: `Current GPS location (within ${geo.coords.accuracy} m)`,
      source: 'gps',
      accuracy: geo.coords.accuracy,
    });
    setFlyTarget((prev) => ({
      lat: geo.coords!.lat,
      lng: geo.coords!.lng,
      zoom: 15,
      seq: (prev?.seq ?? 0) + 1,
    }));
  }, [geo.coords]);

  // Fetch verified SafeStop partners
  const loadPartners = useCallback(async () => {
    setLoadingPartners(true);
    setPartnersError(null);
    try {
      const res = await fetchNearbyPartners({
        lat: origin.lat,
        lng: origin.lng,
        radius_km: radiusKm,
        category,
        available_only: availableOnly,
      });
      setPartners(res.results);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Could not load nearby verified SafePlaces. Check your connection.';
      setPartnersError(msg);
      pushToast({ tone: 'error', title: 'Nearby search failed', description: msg });
    } finally {
      setLoadingPartners(false);
    }
  }, [origin.lat, origin.lng, radiusKm, category, availableOnly, pushToast]);

  useEffect(() => {
    void loadPartners();
  }, [loadPartners]);

  // Fetch separate unverified OSM places when toggle is active
  const loadOsmPlaces = useCallback(async () => {
    if (!showOsmLayer) {
      setOsmPlaces([]);
      setOsmUnavailable(false);
      return;
    }
    setLoadingOsm(true);
    try {
      const res = await geoNearbyPlaces({
        lat: origin.lat,
        lng: origin.lng,
        radiusM: Math.min(radiusKm * 1000, 10000),
        category,
      });
      setOsmPlaces(res.results);
      setOsmUnavailable(res.unavailable);
      if (res.unavailable && res.detail) {
        pushToast({ tone: 'warning', title: 'OpenStreetMap layer unavailable', description: res.detail });
      }
    } catch {
      setOsmPlaces([]);
      setOsmUnavailable(true);
    } finally {
      setLoadingOsm(false);
    }
  }, [showOsmLayer, origin.lat, origin.lng, radiusKm, category, pushToast]);

  useEffect(() => {
    void loadOsmPlaces();
  }, [loadOsmPlaces]);

  // Debounced manual Nominatim search (500 ms)
  useEffect(() => {
    const trimmed = searchText.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setSearchUnavailable(false);
      return;
    }
    const timer = window.setTimeout(async () => {
      setSearchingGeo(true);
      try {
        const res = await geoSearch(trimmed, 6);
        setSuggestions(res.results);
        setSearchUnavailable(res.unavailable);
      } catch {
        setSuggestions([]);
        setSearchUnavailable(true);
      } finally {
        setSearchingGeo(false);
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  const handleSelectSuggestion = (item: GeoSearchSuggestion) => {
    geo.stop();
    setOrigin({
      lat: item.lat,
      lng: item.lng,
      label: item.display_name,
      source: 'search',
    });
    saveSessionLocation({ lat: item.lat, lng: item.lng, label: item.display_name });
    setSuggestions([]);
    setSearchText(item.display_name.split(',').slice(0, 2).join(', '));
    setFlyTarget((prev) => ({
      lat: item.lat,
      lng: item.lng,
      zoom: 15,
      seq: (prev?.seq ?? 0) + 1,
    }));
  };

  const handleMapPin = useCallback(
    async (lat: number, lng: number) => {
      geo.stop();
      setPinMode(false);
      const fallbackLabel = `Pinned location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      setOrigin({ lat, lng, label: fallbackLabel, source: 'pin' });
      saveSessionLocation({ lat, lng, label: fallbackLabel });
      try {
        const rev = await geoReverse(lat, lng);
        setOrigin({ lat, lng, label: rev.display_name, source: 'pin' });
        saveSessionLocation({ lat, lng, label: rev.display_name });
        pushToast({
          tone: 'info',
          title: 'Location pin updated',
          description: rev.display_name,
        });
      } catch {
        pushToast({ tone: 'info', title: 'Location pin updated', description: fallbackLabel });
      }
    },
    [geo, pushToast],
  );

  // Fetch route via /api/geo/route/
  const loadRoute = useCallback(
    async (target: RouteTarget, profile: 'foot' | 'driving') => {
      setRouteTarget(target);
      setRouteProfile(profile);
      setLoadingRoute(true);
      try {
        const res = await geoRoute({
          fromLat: origin.lat,
          fromLng: origin.lng,
          toLat: target.lat,
          toLng: target.lng,
          profile,
        });
        setRouteData(res);
      } catch {
        const googleUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${target.lat},${target.lng}&travelmode=${profile === 'driving' ? 'driving' : 'walking'}`;
        const osmUrl = `https://www.openstreetmap.org/directions?route=${origin.lat}%2C${origin.lng}%3B${target.lat}%2C${target.lng}`;
        setRouteData({
          profile,
          fallback: true,
          fallback_reason: 'Routing service unreachable; showing direct line and map app links.',
          distance_m: 0,
          duration_s: 60,
          geometry: {
            type: 'LineString',
            coordinates: [
              [origin.lng, origin.lat],
              [target.lng, target.lat],
            ],
          },
          google_maps_url: googleUrl,
          osm_url: osmUrl,
        });
      } finally {
        setLoadingRoute(false);
        setInvalidateSignal((n) => n + 1);
      }
    },
    [origin.lat, origin.lng],
  );

  const routePositions = useMemo<[number, number][]>(() => {
    if (!routeData?.geometry?.coordinates?.length) return [];
    return routeData.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  }, [routeData]);

  const routeBounds = useMemo<[[number, number], [number, number]] | null>(() => {
    if (!routePositions.length) return null;
    let minLat = 90;
    let maxLat = -90;
    let minLng = 180;
    let maxLng = -180;
    routePositions.forEach(([lat, lng]) => {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    });
    return [
      [minLat, minLng],
      [maxLat, maxLng],
    ];
  }, [routePositions]);

  const focusPartner = (partner: PartnerItem) => {
    setSelectedId(partner.id);
    const lat = Number(partner.latitude);
    const lng = Number(partner.longitude);
    setFlyTarget((prev) => ({ lat, lng, zoom: 16, seq: (prev?.seq ?? 0) + 1 }));
    window.setTimeout(() => {
      markerRefs.current[partner.id]?.openPopup();
    }, 350);
  };

  const handleMarkerClick = (id: string) => {
    setSelectedId(id);
    listRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const handleOpenRequestModal = (partner: PartnerItem) => {
    if (!isAuthenticated) {
      pushToast({
        tone: 'info',
        title: 'Sign in required to send a help request',
        description: 'Log in as a Woman account (or use the demo Woman button) to send requests.',
      });
      navigate('/login?next=/app/map');
      return;
    }
    if (user?.role !== 'WOMAN') {
      pushToast({
        tone: 'warning',
        title: 'Switch to a Woman account',
        description: 'Help requests can only be sent from a Woman user account.',
      });
      return;
    }
    setRequestPartner(partner);
    setRequestNote(user?.profile?.emergency_note || '');
    setShareLiveLocation(true);
  };

  const handleSendHelpRequest = async () => {
    if (!requestPartner) return;
    setSendingRequest(true);
    try {
      await createHelpRequest({
        partner: requestPartner.id,
        note: requestNote.trim(),
        share_live_location: shareLiveLocation,
        requester_latitude: shareLiveLocation ? Number(origin.lat.toFixed(6)) : null,
        requester_longitude: shareLiveLocation ? Number(origin.lng.toFixed(6)) : null,
      });
      pushToast({
        tone: 'success',
        title: 'Help request sent',
        description: `Waiting for ${requestPartner.name} to confirm readiness.`,
      });
      setRequestPartner(null);
      navigate('/app/requests');
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Could not send help request',
        description: err instanceof ApiError ? err.message : 'Please try again.',
      });
    } finally {
      setSendingRequest(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Emergency & Disclaimer Strip on Every Map Screen */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border-soft bg-white px-4 py-2.5 text-xs shadow-elev-1">
        <p className="text-charcoal-muted">
          <strong className="text-charcoal">SafeStop 360</strong> is an independent assistance
          network and does not replace official emergency services.
        </p>
        <div className="flex items-center gap-2">
          <a
            href="tel:112"
            aria-label="Call 112 National Emergency"
            className="inline-flex items-center gap-1 rounded-full bg-[var(--color-error-soft)] px-3 py-1 font-bold text-[var(--color-error-deep)] ring-1 ring-[var(--color-error)]"
          >
            <PhoneCall className="h-3.5 w-3.5" />
            Call 112
          </a>
          <a
            href="tel:181"
            aria-label="Call 181 Women Helpline"
            className="inline-flex items-center gap-1 rounded-full bg-[var(--color-pink-soft)] px-3 py-1 font-bold text-[#9b2c63] ring-1 ring-[var(--color-pink)]/50"
          >
            <PhoneCall className="h-3.5 w-3.5" />
            Call 181
          </a>
        </div>
      </div>

      {/* Location Controls & Manual Fallback Bar */}
      <Card className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="primary"
            size="sm"
            data-testid="use-location-btn"
            disabled={geo.status === 'requesting'}
            onClick={() => void geo.requestLocation()}
          >
            {geo.status === 'requesting' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Crosshair className="h-4 w-4" />
            )}
            Use my current location
          </Button>

          {!geo.isWatching ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => geo.startWatching()}
            >
              <Compass className="h-4 w-4" />
              Follow me (live)
            </Button>
          ) : (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => {
                geo.stop();
                pushToast({ tone: 'info', title: 'Live location tracking stopped' });
              }}
            >
              <StopCircle className="h-4 w-4" />
              Stop sharing location
            </Button>
          )}

          <Button
            type="button"
            variant={pinMode ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setPinMode((v) => !v)}
          >
            <MapPin className="h-4 w-4" />
            {pinMode ? 'Tap anywhere on map...' : 'Drop pin on map'}
          </Button>

          {/* Accuracy & Status Readout */}
          <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
            {geo.coords && (
              <Badge tone={geo.accuracyWarning ? 'warning' : 'blue'}>
                within {geo.coords.accuracy} m
              </Badge>
            )}
            {geo.isWatching && <Badge tone="mint">Live tracking active</Badge>}
          </div>
        </div>

        {/* Accuracy > 200m desktop Wi-Fi warning */}
        {geo.accuracyWarning && (
          <div className="flex items-start gap-2 rounded-control border border-[var(--color-warning)] bg-[var(--color-warning-soft)] px-3.5 py-2 text-xs text-[var(--color-warning-deep)]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Low GPS precision ({geo.coords?.accuracy} m — typical on desktop Wi-Fi). For exact
              placement, search your street or drop a pin on the map.
            </span>
          </div>
        )}

        {/* Geolocation Error / Denied Fallback Banner */}
        {geo.error && (
          <div
            role="alert"
            data-testid="geolocation-error-banner"
            className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-[var(--color-error)] bg-[var(--color-error-soft)] px-3.5 py-2.5 text-xs text-[var(--color-error-deep)]"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{geo.error}</span>
            </div>
            <Button size="sm" variant="secondary" onClick={geo.retry}>
              <RefreshCw className="h-3.5 w-3.5" />
              Retry GPS
            </Button>
          </div>
        )}

        {/* Manual Search Box (Nominatim proxy with 500ms debounce) */}
        <div className="relative">
          <div className="neu-input-pill flex items-center gap-2 px-3.5 py-2">
            <Search className="h-4 w-4 shrink-0 text-charcoal-muted" aria-hidden="true" />
            <input
              type="search"
              data-testid="manual-location-input"
              aria-label="Search area, street, or landmark in India"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search street, neighbourhood, or landmark (e.g. Kuvempunagar, Mysuru)..."
              className="w-full bg-transparent text-sm text-charcoal placeholder:text-charcoal-muted/70 focus:outline-none"
            />
            {searchingGeo && <Loader2 className="h-4 w-4 animate-spin text-mint-deep" />}
            {searchText && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setSearchText('');
                  setSuggestions([]);
                }}
                className="rounded-full p-1 text-charcoal-muted hover:bg-warm-surface"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {searchUnavailable && (
            <p className="mt-1.5 text-xs text-[var(--color-warning-deep)]">
              Address search service is temporarily unreachable. Tap &ldquo;Drop pin on map&rdquo;
              to choose your location directly.
            </p>
          )}

          {suggestions.length > 0 && (
            <ul
              role="listbox"
              aria-label="Location suggestions"
              className="absolute left-0 right-0 z-30 mt-1.5 max-h-60 overflow-y-auto rounded-card border border-border-soft bg-white p-1.5 shadow-elev-3"
            >
              {suggestions.map((s) => (
                <li key={`${s.lat}-${s.lng}-${s.display_name}`}>
                  <button
                    type="button"
                    onClick={() => handleSelectSuggestion(s)}
                    className="flex w-full items-start gap-2 rounded-control px-3 py-2 text-left text-xs text-charcoal hover:bg-mint-soft/70"
                  >
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-deep" />
                    <span className="line-clamp-2">{s.display_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-xs text-charcoal-muted">
          Active center: <strong className="text-charcoal">{origin.label}</strong>
        </p>

        {/* Category Chips + Radius Selector + OSM Layer Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-soft pt-3">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Category filters">
            {CATEGORIES.map((cat) => (
              <Chip
                key={cat.value}
                selected={category === cat.value}
                onClick={() => setCategory(cat.value)}
              >
                {cat.label}
              </Chip>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-charcoal-muted">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Radius:</span>
              {RADIUS_OPTIONS.map((km) => (
                <button
                  key={km}
                  type="button"
                  onClick={() => setRadiusKm(km)}
                  className={`rounded-full px-2.5 py-1 text-xs font-bold transition-colors ${
                    radiusKm === km
                      ? 'bg-mint text-mint-deep'
                      : 'bg-warm-surface text-charcoal-muted hover:text-charcoal'
                  }`}
                >
                  {km} km
                </button>
              ))}
            </div>

            <Chip
              selected={availableOnly}
              onClick={() => setAvailableOnly((v) => !v)}
            >
              Available now
            </Chip>

            <Chip
              selected={showOsmLayer}
              icon={<Layers className="h-3.5 w-3.5" />}
              onClick={() => setShowOsmLayer((v) => !v)}
            >
              OSM places (unverified)
            </Chip>
          </div>
        </div>
      </Card>

      {/* Map + Synced List Split Layout */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Interactive Leaflet Map */}
        <div className="relative overflow-hidden rounded-card border border-border-soft bg-white shadow-elev-2 lg:col-span-7">
          <div
            data-testid="safestop-map-container"
            className={`relative h-[60vh] min-h-[380px] w-full sm:h-[64vh] ${
              pinMode ? 'cursor-crosshair' : ''
            }`}
          >
            <MapContainer
              center={[origin.lat, origin.lng]}
              zoom={MYSURU_DEFAULT_ZOOM}
              scrollWheelZoom
              className="h-full w-full"
            >
              <TileLayer
                url={MAP_TILE_URL}
                attribution={MAP_TILE_ATTRIBUTION}
                maxZoom={19}
              />

              <MapLifecycleController
                flyTarget={flyTarget}
                routeBounds={routeBounds}
                invalidateSignal={invalidateSignal}
                pinMode={pinMode}
                onMapPin={handleMapPin}
              />

              {/* User / Active Origin Marker + Accuracy Circle */}
              <Marker
                position={[origin.lat, origin.lng]}
                icon={origin.source === 'gps' ? createUserLocationIcon() : createPinIcon()}
              >
                <Popup>
                  <div className="space-y-1 text-xs">
                    <p className="font-bold text-charcoal">
                      {origin.source === 'gps' ? 'You are here (GPS)' : 'Selected Location'}
                    </p>
                    <p className="text-charcoal-muted">{origin.label}</p>
                  </div>
                </Popup>
              </Marker>

              {origin.source === 'gps' && origin.accuracy && origin.accuracy > 0 && (
                <Circle
                  center={[origin.lat, origin.lng]}
                  radius={Math.min(origin.accuracy, 1500)}
                  pathOptions={{
                    color: '#2563EB',
                    fillColor: '#74B9F4',
                    fillOpacity: 0.16,
                    weight: 1.5,
                  }}
                />
              )}

              {/* Verified SafeStop Partners (Green Markers) */}
              {partners.map((partner) => (
                <Marker
                  key={partner.id}
                  ref={(ref) => {
                    markerRefs.current[partner.id] = ref;
                  }}
                  position={[Number(partner.latitude), Number(partner.longitude)]}
                  icon={createVerifiedPartnerIcon(
                    partner.category,
                    selectedId === partner.id,
                    pendingPartnerId === partner.id,
                  )}
                  eventHandlers={{
                    click: () => handleMarkerClick(partner.id),
                  }}
                >
                  <Popup>
                    <div className="min-w-[220px] space-y-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone="mint">Verified SafePlace</Badge>
                        {partner.is_demo && <Badge tone="violet">Demo</Badge>}
                      </div>
                      <p className="font-display text-sm font-bold text-charcoal">{partner.name}</p>
                      <p className="text-xs text-charcoal-muted">
                        {partner.category_display}
                        {typeof partner.distance_km === 'number'
                          ? ` · ${partner.distance_km.toFixed(2)} km away`
                          : ''}
                      </p>
                      <p className="text-xs text-charcoal-muted">{partner.address}</p>
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="primary"
                          className="flex-1"
                          disabled={partner.availability?.status !== 'AVAILABLE'}
                          onClick={() => handleOpenRequestModal(partner)}
                        >
                          <Send className="h-3.5 w-3.5" />
                          Request Help
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            void loadRoute(
                              {
                                id: partner.id,
                                name: partner.name,
                                lat: Number(partner.latitude),
                                lng: Number(partner.longitude),
                                verified: true,
                              },
                              routeProfile,
                            )
                          }
                        >
                          <Navigation className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Separate Unverified OSM Layer (Grey Markers, Clustered when > 40) */}
              {showOsmLayer && (
                <ClusteredOsmLayer
                  places={osmPlaces}
                  selectedId={selectedId}
                  onSelect={(place) => setSelectedId(place.id)}
                  onDirections={(place) =>
                    void loadRoute(
                      {
                        id: place.id,
                        name: place.name,
                        lat: place.latitude,
                        lng: place.longitude,
                        verified: false,
                      },
                      routeProfile,
                    )
                  }
                />
              )}

              {/* Active Directions Polyline */}
              {routePositions.length >= 2 && (
                <Polyline
                  positions={routePositions}
                  pathOptions={
                    routeData?.fallback
                      ? { color: '#9A7BEA', weight: 4, dashArray: '8 8', opacity: 0.9 }
                      : { color: '#1A5C47', weight: 5, opacity: 0.9 }
                  }
                />
              )}
            </MapContainer>

            {/* Floating Glass Directions Panel */}
            <AnimatePresence>
              {routeTarget && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 16 }}
                  data-testid="directions-panel"
                  className="pointer-events-auto absolute inset-x-3 bottom-3 z-[400]"
                >
                  <GlassCard className="p-3.5 sm:p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-mint-deep">
                          {routeData?.fallback ? 'Direct Distance Estimate' : 'Directions'}
                        </p>
                        <p className="truncate font-display text-sm font-bold text-charcoal">
                          {routeTarget.name}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Close directions"
                        onClick={() => {
                          setRouteTarget(null);
                          setRouteData(null);
                        }}
                        className="rounded-full p-1 text-charcoal-muted hover:bg-white/70"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {loadingRoute ? (
                      <div className="mt-2 flex items-center gap-2 text-xs text-charcoal-muted">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Calculating route...
                      </div>
                    ) : routeData ? (
                      <div className="mt-2 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-extrabold text-charcoal tabular-nums">
                            {formatDistance(routeData.distance_m)},{' '}
                            {formatDuration(routeData.duration_s, routeData.profile)}
                          </p>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void loadRoute(routeTarget, 'foot')}
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                routeProfile === 'foot'
                                  ? 'bg-mint text-mint-deep'
                                  : 'bg-white/80 text-charcoal-muted'
                              }`}
                            >
                              <Footprints className="h-3.5 w-3.5" />
                              Walk
                            </button>
                            <button
                              type="button"
                              onClick={() => void loadRoute(routeTarget, 'driving')}
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                routeProfile === 'driving'
                                  ? 'bg-mint text-mint-deep'
                                  : 'bg-white/80 text-charcoal-muted'
                              }`}
                            >
                              <Car className="h-3.5 w-3.5" />
                              Drive
                            </button>
                          </div>
                        </div>

                        {routeData.fallback && routeData.fallback_reason && (
                          <p className="text-[11px] text-[var(--color-warning-deep)]">
                            {routeData.fallback_reason}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={routeData.google_maps_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-full border border-border-soft bg-white px-3 py-1 text-xs font-semibold text-charcoal hover:border-mint-dark"
                          >
                            Open in Google Maps
                            <ExternalLink className="h-3 w-3" />
                          </a>
                          <a
                            href={routeData.osm_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-full border border-border-soft bg-white px-3 py-1 text-xs font-semibold text-charcoal hover:border-mint-dark"
                          >
                            Open in OpenStreetMap
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    ) : null}
                  </GlassCard>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Map Legend Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-soft bg-warm-white px-4 py-2 text-[11px] text-charcoal-muted">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#2D8A6E]" />
                Verified SafeStop Partner
              </span>
              {showOsmLayer && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full border border-dashed border-white bg-[#7B818A]" />
                  OpenStreetMap listing (not verified)
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" />
                Your GPS / Selected Pin
              </span>
            </div>
            <span>{partners.length} verified in {radiusKm} km</span>
          </div>
        </div>

        {/* Synced Results List */}
        <div className="flex max-h-[68vh] flex-col gap-3 overflow-y-auto pr-1 lg:col-span-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-charcoal">
              Verified SafePlaces ({partners.length})
            </h2>
            {partnersError && (
              <Button size="sm" variant="ghost" onClick={() => void loadPartners()}>
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            )}
          </div>

          {loadingPartners ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="space-y-2.5 p-4">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                </Card>
              ))}
            </div>
          ) : partners.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck className="h-5 w-5" />}
              title={`No verified partners within ${radiusKm} km`}
              description="Try a bigger radius or view OpenStreetMap places for nearby public amenities."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {radiusKm < 10 && (
                    <Button size="sm" onClick={() => setRadiusKm(10)}>
                      Expand to 10 km
                    </Button>
                  )}
                  {!showOsmLayer && (
                    <Button size="sm" variant="secondary" onClick={() => setShowOsmLayer(true)}>
                      View OpenStreetMap places
                    </Button>
                  )}
                </div>
              }
            />
          ) : (
            <div className="space-y-3" data-testid="verified-partners-list">
              {partners.map((partner) => {
                const isSelected = selectedId === partner.id;
                const isAvail = partner.availability?.status === 'AVAILABLE';
                return (
                  <div
                    key={partner.id}
                    ref={(el) => {
                      listRefs.current[partner.id] = el;
                    }}
                  >
                    <Card
                      interactive
                      onClick={() => focusPartner(partner)}
                      className={`cursor-pointer p-4 ${
                        isSelected ? 'border-mint-dark ring-2 ring-mint/60' : ''
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge tone="mint">
                            <CheckCircle2 className="h-3 w-3" />
                            Verified
                          </Badge>
                          {partner.is_demo && <Badge tone="violet">Demo</Badge>}
                        </div>
                        <Badge tone={isAvail ? 'mint' : 'warning'}>
                          {partner.availability?.status_display || 'Offline'}
                        </Badge>
                      </div>

                      <h3 className="mt-2 font-display text-sm font-bold text-charcoal">
                        {partner.name}
                      </h3>
                      <p className="mt-0.5 text-xs text-charcoal-muted">
                        {partner.category_display}
                        {typeof partner.distance_km === 'number'
                          ? ` · ${partner.distance_km.toFixed(2)} km away`
                          : ''}{' '}
                        · {partner.operating_hours}
                      </p>
                      <p className="mt-1 text-xs text-charcoal-muted">{partner.address}</p>

                      {partner.support_services?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {partner.support_services.slice(0, 3).map((svc) => (
                            <span
                              key={svc}
                              className="rounded-full bg-warm-surface px-2 py-0.5 text-[10px] font-medium text-charcoal-muted"
                            >
                              {svc}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={!isAvail}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenRequestModal(partner);
                          }}
                        >
                          <Send className="h-3.5 w-3.5" />
                          {isAvail ? 'Request Help' : 'Currently Unavailable'}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            void loadRoute(
                              {
                                id: partner.id,
                                name: partner.name,
                                lat: Number(partner.latitude),
                                lng: Number(partner.longitude),
                                verified: true,
                              },
                              routeProfile,
                            );
                          }}
                        >
                          <Navigation className="h-3.5 w-3.5" />
                          Get Directions
                        </Button>
                        <a
                          href={`tel:${partner.contact_phone}`}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Call ${partner.name}`}
                          className="inline-flex items-center gap-1 rounded-full border border-border-soft px-3 py-1.5 text-xs font-semibold text-charcoal hover:bg-warm-surface"
                        >
                          <PhoneCall className="h-3.5 w-3.5 text-mint-deep" />
                          Call
                        </a>
                      </div>
                    </Card>
                  </div>
                );
              })}
            </div>
          )}

          {/* Separate Unverified OSM Places Section */}
          {showOsmLayer && (
            <div className="mt-2 space-y-2.5 border-t border-border-soft pt-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-charcoal-muted">
                  OpenStreetMap Listings ({osmPlaces.length})
                </h3>
                <Badge tone="neutral">Not verified by SafeStop</Badge>
              </div>
              <p className="text-[11px] text-charcoal-muted">
                Public OpenStreetMap amenities are shown for situational reference only and cannot
                receive SafeStop help requests.
              </p>

              {loadingOsm ? (
                <Skeleton className="h-20 w-full" />
              ) : osmUnavailable ? (
                <Card surface="matte-subtle" className="p-3 text-xs text-charcoal-muted">
                  OpenStreetMap Overpass mirrors did not respond. Verified SafeStop partners remain
                  available above.
                </Card>
              ) : (
                osmPlaces.slice(0, 15).map((place) => (
                  <Card
                    key={place.id}
                    surface="matte-subtle"
                    onClick={() => {
                      setSelectedId(place.id);
                      setFlyTarget((prev) => ({
                        lat: place.latitude,
                        lng: place.longitude,
                        zoom: 16,
                        seq: (prev?.seq ?? 0) + 1,
                      }));
                    }}
                    className="cursor-pointer p-3.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone="neutral">OpenStreetMap · Unverified</Badge>
                      <span className="text-xs font-semibold text-charcoal-muted tabular-nums">
                        {place.distance_km.toFixed(2)} km
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-bold text-charcoal">{place.name}</p>
                    <p className="text-xs text-charcoal-muted">
                      {place.category_display} · {place.address}
                    </p>
                    <div className="mt-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          void loadRoute(
                            {
                              id: place.id,
                              name: place.name,
                              lat: place.latitude,
                              lng: place.longitude,
                              verified: false,
                            },
                            routeProfile,
                          );
                        }}
                      >
                        <Navigation className="h-3.5 w-3.5" />
                        Get Directions
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Help Request Consent Modal */}
      <Modal
        open={requestPartner !== null}
        onClose={() => setRequestPartner(null)}
        title={`Request Assistance at ${requestPartner?.name || ''}`}
        subtitle="Only this verified partner receives your request. Pending requests auto-expire after 10 minutes."
      >
        {requestPartner && (
          <div className="space-y-4">
            <div className="rounded-control border border-border-soft bg-white p-3.5 text-xs text-charcoal-muted">
              <p className="font-bold text-charcoal">{requestPartner.address}</p>
              <p className="mt-0.5">
                {requestPartner.category_display} · {requestPartner.operating_hours}
              </p>
            </div>

            <div className="rounded-control border border-mint-dark/40 bg-mint-soft/45 p-3.5">
              <Switch
                checked={shareLiveLocation}
                onChange={setShareLiveLocation}
                label="Share my live location with this place until the request closes"
                description="Opt-in consent: shared with this partner ONLY after they accept, and all location pings are deleted automatically when the request closes or cancels."
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="help-req-note" className="block text-xs font-semibold text-charcoal">
                Optional note for the partner desk
              </label>
              <textarea
                id="help-req-note"
                rows={3}
                maxLength={320}
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
                placeholder="e.g. Walking over from the main bus stop, arriving in ~5 minutes."
                className="neu-input-pill w-full px-3.5 py-2.5 text-sm text-charcoal focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <Link to="/app/requests" className="text-xs font-semibold text-mint-deep underline">
                View active requests
              </Link>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setRequestPartner(null)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  disabled={sendingRequest}
                  onClick={handleSendHelpRequest}
                >
                  {sendingRequest ? 'Sending...' : 'Send Help Request'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
