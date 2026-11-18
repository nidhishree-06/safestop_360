import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, Circle, useMap } from 'react-leaflet';
import {
  Crosshair,
  Search,
  MapPin,
  Clock,
  Phone,
  ShieldCheck,
  Navigation,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { fetchNearbyPartners, ApiError } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import type { PartnerAvailabilityStatus, PartnerCategory, PartnerItem } from '@/types';

const BENGALURU_PRESETS = [
  { label: 'Indiranagar', lat: 12.978369, lng: 77.640836 },
  { label: 'MG Road / Central', lat: 12.975596, lng: 77.606612 },
  { label: 'Koramangala', lat: 12.935193, lng: 77.624481 },
  { label: 'Jayanagar', lat: 12.929869, lng: 77.583539 },
  { label: 'Malleswaram', lat: 13.00311, lng: 77.56432 },
  { label: 'Whitefield', lat: 12.985042, lng: 77.73641 },
];

const CATEGORIES: Array<{ value: 'ALL' | PartnerCategory; label: string }> = [
  { value: 'ALL', label: 'All SafeStops' },
  { value: 'PHARMACY', label: 'Pharmacy' },
  { value: 'HOSPITAL', label: 'Hospital' },
  { value: 'PETROL_STATION', label: 'Petrol Station' },
  { value: 'SHOP', label: 'Shop' },
  { value: 'HOTEL', label: 'Hotel' },
  { value: 'COLLEGE_FACILITY', label: 'College Facility' },
];

function createPartnerMarkerIcon(status: PartnerAvailabilityStatus, selected: boolean) {
  const fill =
    status === 'AVAILABLE'
      ? '#68BFA3'
      : status === 'BUSY'
        ? '#E2B93B'
        : '#8B9097';
  const ring = selected ? '0 0 0 5px rgba(167,232,210,0.85)' : '0 4px 12px rgba(34,37,42,0.22)';
  const size = selected ? 34 : 28;
  return L.divIcon({
    className: 'safestop-marker-wrapper',
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${fill};border:3px solid #ffffff;box-shadow:${ring};display:flex;align-items:center;justify-content:center;transition:transform 0.15s ease;">
      <div style="width:8px;height:8px;border-radius:9999px;background:#ffffff;"></div>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

const userLocationIcon = L.divIcon({
  className: 'safestop-user-pin',
  html: `<div style="width:18px;height:18px;border-radius:9999px;background:#9A7BEA;border:3px solid #ffffff;box-shadow:0 0 0 6px rgba(154,123,234,0.28);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function MapRecenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], map.getZoom(), { duration: 0.55 });
  }, [lat, lng, map]);
  return null;
}

function availabilityTone(status?: PartnerAvailabilityStatus): 'mint' | 'warning' | 'neutral' {
  if (status === 'AVAILABLE') return 'mint';
  if (status === 'BUSY') return 'warning';
  return 'neutral';
}

export function buildDirectionsUrl(
  fromLat: number,
  fromLng: number,
  toLat: number | string,
  toLng: number | string
) {
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${fromLat}%2C${fromLng}%3B${toLat}%2C${toLng}`;
}

interface SafePlacesMapProps {
  onRequestAssistance?: (partner: PartnerItem, origin: { lat: number; lng: number }) => void;
}

export function SafePlacesMap({ onRequestAssistance }: SafePlacesMapProps) {
  const { user } = useAuth();

  const [origin, setOrigin] = useState<{ lat: number; lng: number; label: string; isGps: boolean }>({
    lat: BENGALURU_PRESETS[0].lat,
    lng: BENGALURU_PRESETS[0].lng,
    label: 'Indiranagar, Bengaluru (Manual Reference)',
    isGps: false,
  });
  const [category, setCategory] = useState<'ALL' | PartnerCategory>('ALL');
  const [searchText, setSearchText] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [partners, setPartners] = useState<PartnerItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoNotice, setGeoNotice] = useState<string | null>(null);

  const loadPartners = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNearbyPartners({
        lat: origin.lat,
        lng: origin.lng,
        radius_km: 30,
        category,
        search: searchText,
        available_only: availableOnly,
      });
      setPartners(data.results);
      if (data.results.length > 0) {
        setSelectedId((prev) =>
          prev && data.results.some((p) => p.id === prev) ? prev : data.results[0].id
        );
      } else {
        setSelectedId(null);
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Unable to load nearby verified SafePlaces. Ensure the Django API is running.'
      );
    } finally {
      setLoading(false);
    }
  }, [origin.lat, origin.lng, category, searchText, availableOnly]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadPartners();
    }, 180);
    return () => window.clearTimeout(timer);
  }, [loadPartners]);

  const handleUseGps = () => {
    setGeoNotice(null);
    if (!navigator.geolocation) {
      setGeoNotice('Geolocation is not supported by your browser. Choose an area manually below.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          label: 'Your Current Device Location (Private, Not Shared Publicly)',
          isGps: true,
        });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setGeoNotice(
          'Location permission was declined or unavailable. You can safely choose a Bengaluru area manually.'
        );
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const selectedPartner = useMemo(
    () => partners.find((p) => p.id === selectedId) || null,
    [partners, selectedId]
  );

  return (
    <div className="space-y-5">
      {/* Floating Liquid Glass Search & Filter Controls */}
      <Card surface="glass" className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="neu-input-pill flex flex-1 items-center gap-2 px-3.5 py-2">
            <Search className="h-4 w-4 shrink-0 text-charcoal-muted" aria-hidden="true" />
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search verified SafePlaces by name, road, or neighbourhood..."
              aria-label="Search nearby SafePlaces"
              className="w-full bg-transparent text-sm text-charcoal placeholder:text-charcoal-muted/75 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={handleUseGps}
              disabled={locating}
            >
              <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
              {locating ? 'Locating...' : 'Use My Location'}
            </Button>

            <label className="neu-chip inline-flex cursor-pointer items-center gap-2 px-3.5 py-1.5 text-xs font-semibold">
              <input
                type="checkbox"
                checked={availableOnly}
                onChange={(e) => setAvailableOnly(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#68bfa3]"
              />
              Available Now
            </label>

            <button
              type="button"
              onClick={loadPartners}
              aria-label="Refresh SafePlaces"
              className="neu-chip inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Manual Neighbourhood Presets */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="mr-1 font-semibold text-charcoal-muted">Manual area:</span>
          {BENGALURU_PRESETS.map((preset) => {
            const active =
              !origin.isGps &&
              Math.abs(origin.lat - preset.lat) < 0.0001 &&
              Math.abs(origin.lng - preset.lng) < 0.0001;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() =>
                  setOrigin({
                    lat: preset.lat,
                    lng: preset.lng,
                    label: `${preset.label}, Bengaluru (Manual Reference)`,
                    isGps: false,
                  })
                }
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-charcoal text-white'
                    : 'bg-white/75 text-charcoal-muted hover:bg-white hover:text-charcoal'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Category Filter Chips */}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by partner category">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setCategory(cat.value)}
              className={`neu-chip px-3.5 py-1.5 text-xs font-semibold ${
                category === cat.value ? 'neu-chip-active' : ''
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {geoNotice && (
          <p className="rounded-xl bg-[var(--color-warning-soft)] px-3 py-2 text-xs text-[var(--color-warning-deep)]">
            {geoNotice}
          </p>
        )}
      </Card>

      {/* Main Split: Leaflet Interactive Map + Matte Partner List & Details */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <Card surface="matte" className="overflow-hidden p-2">
            <div className="relative h-[430px] w-full overflow-hidden rounded-2xl sm:h-[500px]">
              <MapContainer
                center={[origin.lat, origin.lng]}
                zoom={13}
                scrollWheelZoom
                className="h-full w-full"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapRecenter lat={origin.lat} lng={origin.lng} />

                {/* Private client-only reference pin (never persisted or broadcast) */}
                <Circle
                  center={[origin.lat, origin.lng]}
                  radius={220}
                  pathOptions={{ color: '#9A7BEA', fillColor: '#9A7BEA', fillOpacity: 0.14 }}
                />
                <Marker position={[origin.lat, origin.lng]} icon={userLocationIcon}>
                  <Popup>
                    <p className="text-xs font-semibold text-charcoal">{origin.label}</p>
                  </Popup>
                </Marker>

                {partners.map((partner) => {
                  const status = partner.availability?.status || 'OFFLINE';
                  const lat = Number(partner.latitude);
                  const lng = Number(partner.longitude);
                  return (
                    <Marker
                      key={partner.id}
                      position={[lat, lng]}
                      icon={createPartnerMarkerIcon(status, partner.id === selectedId)}
                      eventHandlers={{
                        click: () => setSelectedId(partner.id),
                      }}
                    >
                      <Popup>
                        <div className="min-w-[200px] space-y-1.5">
                          <p className="font-display text-xs font-bold text-charcoal">
                            {partner.name}
                          </p>
                          <p className="text-[11px] text-charcoal-muted">
                            {partner.category_display} · {partner.area || partner.city}
                          </p>
                          <div className="flex items-center justify-between pt-1 text-[11px]">
                            <span className="font-semibold text-mint-deep">{status}</span>
                            {partner.distance_km != null && (
                              <span className="tabular-nums text-charcoal-muted">
                                {partner.distance_km} km away
                              </span>
                            )}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-1 pt-2.5 text-[11px] text-charcoal-muted">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-mint-deep" />
                Reference: <strong className="text-charcoal">{origin.label}</strong>
              </span>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#68BFA3]" /> Available
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#E2B93B]" /> Busy
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#8B9097]" /> Offline
                </span>
              </div>
            </div>
          </Card>

          {/* Selected Partner Detailed Matte Card */}
          {selectedPartner && (
            <Card surface="matte" className="space-y-4 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="mint">
                      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                      Admin Verified
                    </Badge>
                    <Badge tone={availabilityTone(selectedPartner.availability?.status)}>
                      {selectedPartner.availability?.status || 'OFFLINE'}
                    </Badge>
                    {selectedPartner.is_demo && <Badge tone="violet">Demo Location</Badge>}
                  </div>
                  <h2 className="mt-2.5 font-display text-xl font-bold text-charcoal">
                    {selectedPartner.name}
                  </h2>
                  <p className="text-xs font-medium text-charcoal-muted">
                    {selectedPartner.category_display} · {selectedPartner.address}
                  </p>
                </div>
                {selectedPartner.distance_km != null && (
                  <div className="rounded-2xl bg-warm-white px-3.5 py-2 text-right">
                    <p className="font-display text-lg font-extrabold text-mint-deep tabular-nums">
                      {selectedPartner.distance_km} km
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-charcoal-muted">
                      Distance
                    </p>
                  </div>
                )}
              </div>

              {selectedPartner.description && (
                <p className="text-sm leading-relaxed text-charcoal-muted">
                  {selectedPartner.description}
                </p>
              )}

              <div className="grid gap-3 text-xs sm:grid-cols-2">
                <div className="flex items-center gap-2 rounded-xl bg-warm-white px-3 py-2.5">
                  <Clock className="h-4 w-4 text-mint-deep" aria-hidden="true" />
                  <span>
                    Hours: <strong className="text-charcoal">{selectedPartner.operating_hours}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-warm-white px-3 py-2.5">
                  <Phone className="h-4 w-4 text-mint-deep" aria-hidden="true" />
                  <a
                    href={`tel:${selectedPartner.contact_phone}`}
                    className="font-semibold text-charcoal hover:underline"
                  >
                    {selectedPartner.contact_phone}
                  </a>
                </div>
              </div>

              {selectedPartner.support_services?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedPartner.support_services.map((service) => (
                    <span
                      key={service}
                      className="inline-flex items-center gap-1 rounded-full bg-mint-soft/70 px-2.5 py-1 text-[11px] font-medium text-mint-deep"
                    >
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      {service}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 border-t border-border-soft pt-4">
                {user?.role === 'WOMAN' && onRequestAssistance ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    disabled={selectedPartner.availability?.status === 'OFFLINE'}
                    onClick={() =>
                      onRequestAssistance(selectedPartner, {
                        lat: origin.lat,
                        lng: origin.lng,
                      })
                    }
                  >
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    {selectedPartner.availability?.status === 'OFFLINE'
                      ? 'Currently Offline'
                      : 'Request Assistance Here'}
                  </Button>
                ) : !user ? (
                  <Link to="/login?next=/app/map">
                    <Button type="button" variant="primary" size="md">
                      Sign In to Request Assistance
                    </Button>
                  </Link>
                ) : null}

                <a
                  href={buildDirectionsUrl(
                    origin.lat,
                    origin.lng,
                    selectedPartner.latitude,
                    selectedPartner.longitude
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button type="button" variant="secondary" size="md">
                    <Navigation className="h-4 w-4" aria-hidden="true" />
                    OSM Directions
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </a>
              </div>
            </Card>
          )}
        </div>

        {/* Right Column: Matte Nearby Partners List */}
        <div className="space-y-3 lg:col-span-5">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-display text-base font-bold text-charcoal">
              Verified Nearby SafeStops ({partners.length})
            </h2>
            <span className="text-xs text-charcoal-muted">Sorted nearest first</span>
          </div>

          {error && (
            <Card surface="matte" className="border-[var(--color-error)] p-4">
              <div className="flex items-start gap-2.5 text-xs text-[var(--color-error-deep)]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            </Card>
          )}

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="surface-matte h-28 animate-pulse bg-pure-white/80 p-5"
                />
              ))}
            </div>
          ) : partners.length === 0 ? (
            <Card surface="matte" className="p-6 text-center">
              <p className="font-display text-base font-bold text-charcoal">
                No matching verified SafeStops found
              </p>
              <p className="mt-1 text-xs text-charcoal-muted">
                Try clearing your category filter or switching to a Bengaluru area preset.
              </p>
            </Card>
          ) : (
            <div className="max-h-[680px] space-y-3 overflow-y-auto pr-1">
              {partners.map((partner) => {
                const isSelected = partner.id === selectedId;
                const avail = partner.availability?.status || 'OFFLINE';
                return (
                  <button
                    key={partner.id}
                    type="button"
                    onClick={() => setSelectedId(partner.id)}
                    className={`surface-matte block w-full p-4 text-left transition-all ${
                      isSelected
                        ? 'border-mint-dark ring-2 ring-mint/60'
                        : 'surface-matte-interactive'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-display text-sm font-bold text-charcoal">
                          {partner.name}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-charcoal-muted">
                          {partner.category_display} · {partner.area || partner.city}
                        </p>
                      </div>
                      {partner.distance_km != null && (
                        <span className="shrink-0 rounded-full bg-warm-white px-2.5 py-1 text-xs font-bold text-charcoal tabular-nums">
                          {partner.distance_km} km
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Badge tone={availabilityTone(avail)}>{avail}</Badge>
                        {partner.is_demo && <Badge tone="neutral">Demo</Badge>}
                      </div>
                      <span className="text-[11px] text-charcoal-muted">
                        {partner.operating_hours}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
