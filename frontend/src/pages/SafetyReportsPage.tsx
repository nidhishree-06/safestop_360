import { useCallback, useEffect, useState, type FormEvent } from 'react';
import L from 'leaflet';
import {
  Circle,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMapEvents,
} from 'react-leaflet';
import {
  Megaphone,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Brain,
  Send,
  EyeOff,
} from 'lucide-react';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { EmergencyBanner } from '@/components/ui/EmergencyBanner';
import { useToast } from '@/context/ToastContext';
import {
  ApiError,
  createSafetyReport,
  fetchSafetyIntelligence,
  fetchSafetyReports,
} from '@/services/api';
import type {
  SafetyIntelligenceSummary,
  SafetyReportCategory,
  SafetyReportItem,
} from '@/types';

const REPORT_CATEGORIES: Array<{ value: SafetyReportCategory; label: string }> = [
  { value: 'POOR_LIGHTING', label: 'Poor Lighting' },
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'ISOLATED_AREA', label: 'Isolated Area' },
  { value: 'UNSAFE_INFRASTRUCTURE', label: 'Unsafe Public Infrastructure' },
  { value: 'OTHER', label: 'Other' },
];

function makeReportPin(isUnreviewed: boolean) {
  const bg = isUnreviewed ? '#E2B93B' : '#9A7BEA';
  return L.divIcon({
    className: 'safestop-report-pin',
    html: `<div style="width:24px;height:24px;border-radius:9999px;background:${bg};border:3px solid #ffffff;box-shadow:0 4px 10px rgba(34,37,42,0.22);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

const draftPinIcon = L.divIcon({
  className: 'safestop-draft-pin',
  html: `<div style="width:22px;height:22px;border-radius:9999px;background:#E96BA8;border:3px solid #ffffff;box-shadow:0 0 0 6px rgba(233,107,168,0.28);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function MapClickPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
    },
  });
  return null;
}

export function SafetyReportsPage() {
  const { pushToast } = useToast();

  const [reports, setReports] = useState<SafetyReportItem[]>([]);
  const [intelligence, setIntelligence] = useState<SafetyIntelligenceSummary | null>(null);
  const [filterCat, setFilterCat] = useState<'ALL' | SafetyReportCategory>('ALL');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Submission form state
  const [category, setCategory] = useState<SafetyReportCategory>('POOR_LIGHTING');
  const [areaLabel, setAreaLabel] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [lat, setLat] = useState(12.971599);
  const [lng, setLng] = useState(77.594566);
  const [description, setDescription] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [repRes, intelRes] = await Promise.all([
        fetchSafetyReports({ category: filterCat }),
        fetchSafetyIntelligence(),
      ]);
      setReports(repRes.results);
      setIntelligence(intelRes);
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Failed to load safety reports',
        description: err instanceof ApiError ? err.message : 'Check backend connection.',
      });
    } finally {
      setLoading(false);
    }
  }, [filterCat, pushToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (description.trim().length < 10) {
      pushToast({
        tone: 'warning',
        title: 'Description too short',
        description: 'Please write at least 10 characters explaining the issue.',
      });
      return;
    }
    setSubmitting(true);
    try {
      const created = await createSafetyReport({
        category,
        area_label: areaLabel.trim(),
        city: city.trim() || 'Bengaluru',
        latitude: lat,
        longitude: lng,
        description: description.trim(),
        incident_time: new Date().toISOString(),
      });
      setReports((prev) => [created, ...prev]);
      setAreaLabel('');
      setDescription('');
      fetchSafetyIntelligence().then(setIntelligence).catch(() => {});
      pushToast({
        tone: 'success',
        title: 'Safety report submitted anonymously',
        description: 'Tagged as UNREVIEWED until checked by an administrator.',
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Submission failed',
        description: err instanceof ApiError ? err.message : 'Please verify fields.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout
      title="Community Safety Reports"
      subtitle="Share anonymous observations about lighting, isolation, harassment, or public infrastructure. Reporter identities are never displayed publicly."
    >
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Aggregated Community Reports Map */}
        <div className="space-y-4 lg:col-span-7">
          <Card surface="matte" className="space-y-3 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 px-2 pt-1">
              <span className="text-xs font-bold text-charcoal">
                Aggregated Safety Report Map (click map to set new report pin)
              </span>
              <div className="flex items-center gap-3 text-[11px] text-charcoal-muted">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#E2B93B]" /> Unreviewed
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#9A7BEA]" /> Reviewed
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#E96BA8]" /> New Pin
                </span>
              </div>
            </div>

            <div className="h-[380px] w-full overflow-hidden rounded-2xl">
              <MapContainer
                center={[lat, lng]}
                zoom={12}
                scrollWheelZoom
                className="h-full w-full"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickPicker
                  onPick={(newLat, newLng) => {
                    setLat(newLat);
                    setLng(newLng);
                  }}
                />

                {/* Spatial repeated clusters (500m radius) */}
                {intelligence?.repeated_report_clusters.map((cluster) => (
                  <Circle
                    key={cluster.cluster_id}
                    center={[cluster.center_lat, cluster.center_lng]}
                    radius={500}
                    pathOptions={{
                      color: '#9A7BEA',
                      fillColor: '#9A7BEA',
                      fillOpacity: 0.16,
                    }}
                  />
                ))}

                {/* Draft pin for new report */}
                <Marker position={[lat, lng]} icon={draftPinIcon}>
                  <Popup>
                    <p className="text-xs font-semibold text-charcoal">
                      Selected location for your new report ({lat}, {lng})
                    </p>
                  </Popup>
                </Marker>

                {reports.map((rep) => (
                  <Marker
                    key={rep.id}
                    position={[Number(rep.latitude), Number(rep.longitude)]}
                    icon={makeReportPin(rep.is_unreviewed)}
                  >
                    <Popup>
                      <div className="max-w-[220px] space-y-1">
                        <p className="font-display text-xs font-bold text-charcoal">
                          {rep.area_label}
                        </p>
                        <p className="text-[11px] font-semibold text-[#51379c]">
                          {rep.category_display} · {rep.review_status_display}
                        </p>
                        <p className="text-[11px] text-charcoal-muted">
                          {rep.description}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </Card>

          {/* Rule-Based Pattern Summary */}
          {intelligence && (
            <Card surface="matte-subtle" className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-[#51379c]" />
                  <h2 className="font-display text-sm font-bold text-charcoal">
                    Explainable Rule-Based Pattern Summary
                  </h2>
                </div>
                <Badge tone="violet">
                  {intelligence.repeated_report_clusters.length} repeated cluster(s)
                </Badge>
              </div>
              <ul className="list-disc space-y-1 pl-5 text-xs text-charcoal-muted">
                {intelligence.summary_notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
              <p className="rounded-xl bg-pure-white p-3 text-[11px] leading-relaxed text-charcoal-muted">
                {intelligence.methodology_and_limitations}
              </p>
            </Card>
          )}
        </div>

        {/* Right: Submit New Report Form */}
        <div className="lg:col-span-5">
          <Card surface="matte" className="space-y-4 p-6">
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-[#9b2c63]" />
              <h2 className="font-display text-lg font-bold text-charcoal">
                Submit a Safety Observation
              </h2>
            </div>

            <div className="flex items-start gap-2 rounded-2xl bg-warm-white p-3 text-xs text-charcoal-muted">
              <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-mint-deep" />
              <span>
                Your identity is never shown publicly. New reports are labelled{' '}
                <strong>UNREVIEWED</strong> until verified by administrators.
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-charcoal">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as SafetyReportCategory)}
                  className="neu-input-pill w-full px-3.5 py-2.5 text-sm text-charcoal focus:outline-none"
                >
                  {REPORT_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Area / Street / Landmark"
                value={areaLabel}
                onChange={(e) => setAreaLabel(e.target.value)}
                placeholder="e.g. Indiranagar Metro Feeder Lane"
                leftIcon={<MapPin className="h-4 w-4" />}
                required
              />

              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  label="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                />
                <Input
                  label="Latitude"
                  type="number"
                  step="0.000001"
                  value={lat}
                  onChange={(e) => setLat(Number(e.target.value))}
                  required
                />
                <Input
                  label="Longitude"
                  type="number"
                  step="0.000001"
                  value={lng}
                  onChange={(e) => setLng(Number(e.target.value))}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-charcoal">
                  Observation Details
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the lighting, footpath, or safety concern without naming private individuals..."
                  className="neu-input-pill w-full px-3.5 py-2.5 text-sm text-charcoal focus:outline-none"
                  required
                />
              </div>

              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={submitting}>
                <Send className="h-4 w-4" />
                {submitting ? 'Submitting...' : 'Submit Anonymous Report'}
              </Button>
            </form>
          </Card>
        </div>
      </div>

      {/* Community Reports Feed */}
      <Card surface="matte" className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-charcoal">
            Community Safety Reports ({reports.length})
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {[{ value: 'ALL', label: 'All' }, ...REPORT_CATEGORIES].map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setFilterCat(cat.value as 'ALL' | SafetyReportCategory)}
                className={`neu-chip px-3 py-1 text-xs font-semibold ${
                  filterCat === cat.value ? 'neu-chip-active' : ''
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-warm-white" />
        ) : reports.length === 0 ? (
          <p className="text-sm text-charcoal-muted">No reports match this category.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {reports.map((rep) => (
              <div
                key={rep.id}
                className="space-y-2 rounded-2xl border border-border-soft bg-warm-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge tone="neutral">{rep.category_display}</Badge>
                  <Badge
                    tone={
                      rep.review_status === 'REVIEWED'
                        ? 'mint'
                        : rep.review_status === 'UNDER_REVIEW'
                          ? 'blue'
                          : 'warning'
                    }
                  >
                    {rep.is_unreviewed ? (
                      <AlertTriangle className="h-3 w-3" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    {rep.review_status_display}
                  </Badge>
                </div>
                <p className="font-display text-sm font-bold text-charcoal">
                  {rep.area_label}
                </p>
                <p className="text-xs leading-relaxed text-charcoal-muted">
                  {rep.description}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-charcoal-muted">
                  <span>{new Date(rep.created_at).toLocaleString()}</span>
                  {rep.ai_classification?.matched_themes && (
                    <span className="font-medium text-[#51379c]">
                      Themes: {rep.ai_classification.matched_themes.join(', ')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <EmergencyBanner />
    </DashboardLayout>
  );
}
