import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import { Info, MapPin, Megaphone, Send, Sparkles } from 'lucide-react';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge, Button, Card, Input, Select, Skeleton } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import {
  createPinIcon,
  MAP_TILE_ATTRIBUTION,
  MAP_TILE_URL,
  MYSURU_DEFAULT_CENTER,
} from '@/lib/leaflet';
import {
  ApiError,
  createSafetyReport,
  fetchSafetyIntelligence,
  fetchSafetyReports,
  geoReverse,
} from '@/services/api';
import type {
  SafetyIntelligenceSummary,
  SafetyReportCategory,
  SafetyReportItem,
} from '@/types';

const REPORT_CATEGORIES: Array<{ value: SafetyReportCategory; label: string }> = [
  { value: 'POOR_LIGHTING', label: 'Poor Street Lighting' },
  { value: 'HARASSMENT', label: 'Verbal / Street Harassment' },
  { value: 'ISOLATED_AREA', label: 'Isolated Area' },
  { value: 'UNSAFE_INFRASTRUCTURE', label: 'Unsafe Public Infrastructure' },
  { value: 'OTHER', label: 'Other Observation' },
];

function ReportPinPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function SafetyReportsPage() {
  const { pushToast } = useToast();
  const [reports, setReports] = useState<SafetyReportItem[]>([]);
  const [intel, setIntel] = useState<SafetyIntelligenceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [category, setCategory] = useState<SafetyReportCategory>('POOR_LIGHTING');
  const [areaLabel, setAreaLabel] = useState('');
  const [city, setCity] = useState('Mysuru');
  const [description, setDescription] = useState('');
  const [pinCoords, setPinCoords] = useState<{ lat: number; lng: number }>({
    lat: MYSURU_DEFAULT_CENTER.lat,
    lng: MYSURU_DEFAULT_CENTER.lng,
  });
  const [submitting, setSubmitting] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [repRes, intelRes] = await Promise.all([
        fetchSafetyReports(),
        fetchSafetyIntelligence(),
      ]);
      setReports(repRes.results);
      setIntel(intelRes);
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Failed to load safety reports',
        description: err instanceof ApiError ? err.message : 'Check your connection.',
      });
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handlePinPick = async (lat: number, lng: number) => {
    setPinCoords({ lat, lng });
    try {
      const rev = await geoReverse(lat, lng);
      if (!areaLabel.trim()) {
        setAreaLabel(rev.display_name.split(',').slice(0, 2).join(', '));
      }
    } catch {
      // Keep manual area label
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (description.trim().length < 10) {
      pushToast({
        tone: 'warning',
        title: 'Description too short',
        description: 'Please write at least 10 characters describing what you observed.',
      });
      return;
    }
    setSubmitting(true);
    try {
      await createSafetyReport({
        category,
        area_label: areaLabel.trim() || 'Mysuru Area',
        city: city.trim() || 'Mysuru',
        description: description.trim(),
        latitude: Number(pinCoords.lat.toFixed(6)),
        longitude: Number(pinCoords.lng.toFixed(6)),
        incident_time: new Date().toISOString(),
      });
      setDescription('');
      setAreaLabel('');
      pushToast({
        tone: 'success',
        title: 'Anonymous observation submitted',
        description:
          'Your identity is never exposed publicly. Public maps round coordinates to ~3 decimals.',
      });
      await loadAll();
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Could not submit report',
        description: err instanceof ApiError ? err.message : 'Please retry.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout
      title="Community Safety Reports & Area Trends"
      subtitle="Submit anonymous local observations and review explainable rule-based 300 m area summaries."
    >
      {/* Ethical non-claim notice */}
      <div className="flex items-start gap-2.5 rounded-card border border-border-soft bg-white p-4 text-xs text-charcoal-muted shadow-elev-1">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-mint-deep" />
        <p>
          {intel?.non_claim_notice ||
            "Rule-based summary of community-submitted observations. Never labels any area as 'safe' or 'dangerous'. Public maps use rounded coordinates (~3 decimals) and grouped clusters."}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Submit Anonymous Report */}
        <Card className="space-y-4 p-6 lg:col-span-5">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-[var(--color-pink)]" />
            <h2 className="font-display text-lg font-bold text-charcoal">
              Report an Area Observation
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <Select
              label="Observation Category"
              value={category}
              onChange={(e) => setCategory(e.target.value as SafetyReportCategory)}
              options={REPORT_CATEGORIES}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Area / Landmark"
                required
                value={areaLabel}
                onChange={(e) => setAreaLabel(e.target.value)}
                placeholder="e.g. Suburban Bus Stand Lane"
              />
              <Input
                label="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-charcoal">
                Tap map to set approximate location ({pinCoords.lat.toFixed(3)},{' '}
                {pinCoords.lng.toFixed(3)})
              </p>
              <div className="h-44 w-full overflow-hidden rounded-control border border-border-soft">
                <MapContainer
                  center={[pinCoords.lat, pinCoords.lng]}
                  zoom={13}
                  className="h-full w-full"
                >
                  <TileLayer url={MAP_TILE_URL} attribution={MAP_TILE_ATTRIBUTION} maxZoom={19} />
                  <ReportPinPicker onPick={(lat, lng) => void handlePinPick(lat, lng)} />
                  <Marker position={[pinCoords.lat, pinCoords.lng]} icon={createPinIcon()} />
                </MapContainer>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="report-desc" className="block text-xs font-semibold text-charcoal">
                What did you observe? (min 10 chars)
              </label>
              <textarea
                id="report-desc"
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe lighting, infrastructure, or time-of-day conditions without naming private individuals..."
                className="neu-input-pill w-full px-3.5 py-2.5 text-sm text-charcoal"
              />
            </div>

            <Button type="submit" variant="primary" disabled={submitting}>
              <Send className="h-4 w-4" />
              {submitting ? 'Submitting...' : 'Submit Anonymous Report'}
            </Button>
          </form>
        </Card>

        {/* Rounded Aggregate Cluster Map + Explainable Rule-Based Analysis */}
        <div className="space-y-5 lg:col-span-7">
          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-mint-deep" />
                <h2 className="font-display text-base font-bold text-charcoal">
                  Grouped Community Observations (~300 m, rounded coords)
                </h2>
              </div>
              {intel && (
                <Badge tone="violet">
                  {intel.repeat_areas_count} repeat area(s) in {intel.window_days} days
                </Badge>
              )}
            </div>

            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="h-64 w-full overflow-hidden rounded-control border border-border-soft">
                <MapContainer
                  center={[MYSURU_DEFAULT_CENTER.lat, MYSURU_DEFAULT_CENTER.lng]}
                  zoom={13}
                  className="h-full w-full"
                >
                  <TileLayer url={MAP_TILE_URL} attribution={MAP_TILE_ATTRIBUTION} maxZoom={19} />
                  {(intel?.public_map_clusters || []).map((cluster) => (
                    <Circle
                      key={cluster.cluster_id}
                      center={[cluster.center_lat, cluster.center_lng]}
                      radius={cluster.radius_m}
                      pathOptions={{
                        color: '#E96BA8',
                        fillColor: '#E96BA8',
                        fillOpacity: 0.22,
                        weight: 2,
                      }}
                    >
                      <Popup>
                        <div className="space-y-1 text-xs">
                          <p className="font-bold text-charcoal">{cluster.area_label}</p>
                          <p className="font-semibold text-[#9b2c63]">
                            {cluster.summary_statement}
                          </p>
                          <p className="text-charcoal-muted">{cluster.explanation}</p>
                        </div>
                      </Popup>
                    </Circle>
                  ))}
                </MapContainer>
              </div>
            )}

            {intel && intel.clusters.length > 0 && (
              <div className="space-y-2.5">
                {intel.clusters.slice(0, 5).map((cl) => (
                  <div
                    key={cl.cluster_id}
                    className="rounded-control border border-border-soft bg-warm-white p-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-charcoal">{cl.area_label}</span>
                      <div className="flex items-center gap-1.5">
                        {cl.is_repeat_area && <Badge tone="pink">Repeat area</Badge>}
                        <Badge tone="neutral">{cl.peak_time_window}</Badge>
                      </div>
                    </div>
                    <p className="mt-1 font-semibold text-mint-deep">{cl.summary_statement}</p>
                    <p className="mt-0.5 text-charcoal-muted">{cl.explanation}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Recent Community Reports List */}
          <Card className="space-y-3 p-5">
            <h2 className="font-display text-base font-bold text-charcoal">
              Recent Anonymized Observations ({reports.length})
            </h2>
            <div className="space-y-2.5">
              {reports.slice(0, 10).map((rep) => (
                <div
                  key={rep.id}
                  className="rounded-control border border-border-soft bg-warm-white p-3.5 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={rep.is_unreviewed ? 'warning' : 'mint'}>
                        {rep.review_status_display}
                      </Badge>
                      <Badge tone="neutral">{rep.category_display}</Badge>
                      {rep.is_demo && <Badge tone="violet">Demo</Badge>}
                    </div>
                    <span className="text-charcoal-muted">
                      <MapPin className="mr-0.5 inline h-3 w-3" />~{Number(rep.latitude).toFixed(3)}
                      , ~{Number(rep.longitude).toFixed(3)}
                    </span>
                  </div>
                  <p className="mt-2 font-bold text-charcoal">{rep.area_label}</p>
                  <p className="mt-0.5 text-charcoal-muted">{rep.description}</p>
                  {rep.ai_classification && (
                    <p className="mt-1.5 text-[11px] text-mint-deep">
                      Theme: <strong>{rep.ai_classification.primary_theme}</strong> —{' '}
                      {rep.ai_classification.rationale}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
