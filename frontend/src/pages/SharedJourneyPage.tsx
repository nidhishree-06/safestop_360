import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet';
import { Clock, MapPin, PhoneCall, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';

import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Badge, Button, Card, Skeleton } from '@/components/ui';
import {
  createPinIcon,
  createUserLocationIcon,
  MAP_TILE_ATTRIBUTION,
  MAP_TILE_URL,
  MYSURU_DEFAULT_CENTER,
} from '@/lib/leaflet';
import { ApiError, fetchSharedJourneyStatus } from '@/services/api';
import type { SharedJourneySnapshot } from '@/types';

export function SharedJourneyPage() {
  const { token = '' } = useParams<{ token: string }>();
  const [snapshot, setSnapshot] = useState<SharedJourneySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await fetchSharedJourneyStatus(token);
        if (active) {
          setSnapshot(data);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setSnapshot(null);
          setError(
            err instanceof ApiError
              ? err.message
              : 'This private Journey Watch link is invalid or has expired.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const id = window.setInterval(load, 15000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [token]);

  const trail = useMemo<[number, number][]>(() => {
    if (!snapshot?.recent_pings?.length) return [];
    return snapshot.recent_pings.map((p) => [Number(p.latitude), Number(p.longitude)]);
  }, [snapshot]);

  const mapCenter: [number, number] = useMemo(() => {
    if (snapshot?.last_known_latitude && snapshot?.last_known_longitude) {
      return [Number(snapshot.last_known_latitude), Number(snapshot.last_known_longitude)];
    }
    if (snapshot?.destination_latitude && snapshot?.destination_longitude) {
      return [Number(snapshot.destination_latitude), Number(snapshot.destination_longitude)];
    }
    return [MYSURU_DEFAULT_CENTER.lat, MYSURU_DEFAULT_CENTER.lng];
  }, [snapshot]);

  return (
    <div className="flex min-h-screen flex-col bg-warm-white text-charcoal">
      <Navbar />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-5 px-4 pb-16 pt-24 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge tone="blue">Private Trusted-Contact Status Link</Badge>
          <div className="flex gap-2">
            <a href="tel:112">
              <Button size="sm" variant="danger">
                <PhoneCall className="h-3.5 w-3.5" />
                Call 112
              </Button>
            </a>
            <a href="tel:181">
              <Button size="sm" variant="secondary">
                Call 181
              </Button>
            </a>
          </div>
        </div>

        {loading ? (
          <Card className="space-y-3 p-6">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-64 w-full" />
          </Card>
        ) : error || !snapshot ? (
          <Card className="space-y-4 p-8 text-center">
            <ShieldAlert className="mx-auto h-10 w-10 text-charcoal-muted" />
            <h1 className="font-display text-2xl font-extrabold text-charcoal">
              Journey link expired or revoked
            </h1>
            <p className="mx-auto max-w-md text-sm text-charcoal-muted">
              {error || 'This link automatically expires once the traveler completes or cancels Journey Watch.'}
            </p>
            <Link to="/">
              <Button variant="secondary">Return to SafeStop 360</Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-5">
            <Card className="space-y-3 p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge tone={snapshot.status === 'MISSED' ? 'error' : 'mint'}>
                  {snapshot.status_display}
                </Badge>
                <span className="inline-flex items-center gap-1 text-xs text-charcoal-muted">
                  <RefreshCw className="h-3 w-3" />
                  Auto-updates every 15s
                </span>
              </div>
              <h1 className="font-display text-2xl font-extrabold text-charcoal">
                {snapshot.traveler_name} → {snapshot.destination_label}
              </h1>
              <p className="text-xs text-charcoal-muted">
                Expected arrival: {new Date(snapshot.expected_arrival_at).toLocaleString()} ·
                Location sharing:{' '}
                <strong>{snapshot.location_sharing_enabled ? 'Active' : 'Paused'}</strong>
              </p>
            </Card>

            {snapshot.location_sharing_enabled && (
              <div className="h-80 w-full overflow-hidden rounded-card border border-border-soft bg-white shadow-elev-2">
                <MapContainer center={mapCenter} zoom={14} className="h-full w-full">
                  <TileLayer url={MAP_TILE_URL} attribution={MAP_TILE_ATTRIBUTION} maxZoom={19} />
                  {snapshot.last_known_latitude && snapshot.last_known_longitude && (
                    <Marker
                      position={[
                        Number(snapshot.last_known_latitude),
                        Number(snapshot.last_known_longitude),
                      ]}
                      icon={createUserLocationIcon()}
                    >
                      <Popup>{snapshot.traveler_name} — latest ping</Popup>
                    </Marker>
                  )}
                  {snapshot.destination_latitude && snapshot.destination_longitude && (
                    <Marker
                      position={[
                        Number(snapshot.destination_latitude),
                        Number(snapshot.destination_longitude),
                      ]}
                      icon={createPinIcon()}
                    >
                      <Popup>Destination: {snapshot.destination_label}</Popup>
                    </Marker>
                  )}
                  {trail.length >= 2 && (
                    <Polyline positions={trail} pathOptions={{ color: '#2563EB', weight: 4 }} />
                  )}
                </MapContainer>
              </div>
            )}

            <Card className="space-y-3 p-5">
              <h2 className="font-display text-base font-bold text-charcoal">Check-In Timeline</h2>
              <ul className="space-y-2 text-xs">
                {snapshot.checkins.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-start justify-between gap-3 rounded-control border border-border-soft bg-warm-white p-3"
                  >
                    <div className="flex items-start gap-2">
                      {c.status === 'MISSED_REMINDER' ? (
                        <Clock className="mt-0.5 h-4 w-4 text-[var(--color-error-deep)]" />
                      ) : (
                        <ShieldCheck className="mt-0.5 h-4 w-4 text-mint-deep" />
                      )}
                      <div>
                        <p className="font-bold text-charcoal">{c.status_display}</p>
                        {c.note && <p className="text-charcoal-muted">{c.note}</p>}
                      </div>
                    </div>
                    <span className="shrink-0 text-charcoal-muted">
                      {new Date(c.created_at).toLocaleTimeString()}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="pt-1 text-[11px] text-charcoal-muted">
                <MapPin className="mr-1 inline h-3 w-3" />
                Private link only — never listed on any public map. Expires automatically on
                arrival.
              </p>
            </Card>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
