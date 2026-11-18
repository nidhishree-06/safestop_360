import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { Circle, MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import {
  Building2,
  ShieldAlert,
  Megaphone,
  Users,
  RefreshCw,
  ArrowRight,
  ScrollText,
} from 'lucide-react';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/context/ToastContext';
import { ApiError, fetchAdminAnalytics } from '@/services/api';
import type { AdminAnalyticsResponse } from '@/types';

const partnerPin = L.divIcon({
  className: 'admin-partner-pin',
  html: `<div style="width:20px;height:20px;border-radius:9999px;background:#68BFA3;border:2px solid #ffffff;box-shadow:0 3px 8px rgba(0,0,0,0.2);"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const reportPin = L.divIcon({
  className: 'admin-report-pin',
  html: `<div style="width:18px;height:18px;border-radius:9999px;background:#E96BA8;border:2px solid #ffffff;box-shadow:0 3px 8px rgba(0,0,0,0.2);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export function AdminDashboardPage() {
  const { pushToast } = useToast();
  const [data, setData] = useState<AdminAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAdminAnalytics();
      setData(res);
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Failed to load admin analytics',
        description: err instanceof ApiError ? err.message : 'Check admin session.',
      });
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const counts = data?.counts;

  return (
    <DashboardLayout
      title="Administrator Governance Console"
      subtitle="Live platform telemetry, partner & companion approvals, assistance oversight, aggregated safety map, and audit logs."
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/partners">
            <Button type="button" size="sm" variant="primary">
              Review Partners ({counts?.partners_pending ?? 0} Pending)
            </Button>
          </Link>
          <Link to="/admin/reports">
            <Button type="button" size="sm" variant="secondary">
              Moderate Reports ({counts?.reports_unreviewed ?? 0} Unreviewed)
            </Button>
          </Link>
          <Link to="/admin/companions">
            <Button type="button" size="sm" variant="secondary">
              Verify Companions ({counts?.companions_pending ?? 0} Pending)
            </Button>
          </Link>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={loadAnalytics}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Real-Data KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card surface="matte" className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-charcoal-muted">Partners</span>
            <Building2 className="h-4 w-4 text-mint-deep" />
          </div>
          <p className="mt-2 font-display text-3xl font-extrabold text-charcoal tabular-nums">
            {counts?.partners_approved ?? '—'}
          </p>
          <p className="mt-1 text-xs text-charcoal-muted">
            Approved · {counts?.partners_pending ?? 0} pending ·{' '}
            {counts?.partners_available_now ?? 0} available
          </p>
        </Card>

        <Card surface="matte" className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-charcoal-muted">
              Assistance Requests
            </span>
            <ShieldAlert className="h-4 w-4 text-[#51379c]" />
          </div>
          <p className="mt-2 font-display text-3xl font-extrabold text-charcoal tabular-nums">
            {counts?.requests_total ?? '—'}
          </p>
          <p className="mt-1 text-xs text-charcoal-muted">
            {counts?.requests_active ?? 0} active · {counts?.requests_closed ?? 0} closed
          </p>
        </Card>

        <Card surface="matte" className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-charcoal-muted">
              Safety Reports
            </span>
            <Megaphone className="h-4 w-4 text-[#9b2c63]" />
          </div>
          <p className="mt-2 font-display text-3xl font-extrabold text-charcoal tabular-nums">
            {counts?.reports_total ?? '—'}
          </p>
          <p className="mt-1 text-xs text-charcoal-muted">
            {counts?.reports_unreviewed ?? 0} unreviewed ·{' '}
            {data?.intelligence.repeated_report_clusters.length ?? 0} cluster(s)
          </p>
        </Card>

        <Card surface="matte" className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-charcoal-muted">
              Users &amp; Companions
            </span>
            <Users className="h-4 w-4 text-[#1c598a]" />
          </div>
          <p className="mt-2 font-display text-3xl font-extrabold text-charcoal tabular-nums">
            {counts?.users_total ?? '—'}
          </p>
          <p className="mt-1 text-xs text-charcoal-muted">
            {counts?.companions_approved ?? 0} verified companions ·{' '}
            {counts?.active_journeys_count ?? 0} active private journeys
          </p>
        </Card>
      </div>

      {/* Aggregated Map + AI Summary */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card surface="matte" className="space-y-3 p-3 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2 px-2 pt-1">
            <h2 className="font-display text-sm font-bold text-charcoal">
              Network Overview Map (Approved Partners &amp; Anonymized Reports Only)
            </h2>
            <div className="flex items-center gap-3 text-[11px] text-charcoal-muted">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-[#68BFA3]" /> SafeStops
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-[#E96BA8]" /> Safety Reports
              </span>
            </div>
          </div>
          <div className="h-[340px] w-full overflow-hidden rounded-2xl">
            <MapContainer
              center={[12.971599, 77.61]}
              zoom={12}
              scrollWheelZoom
              className="h-full w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {data?.intelligence.repeated_report_clusters.map((cluster) => (
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
              {data?.map_overview.partners.map((p) => (
                <Marker
                  key={p.id}
                  position={[Number(p.latitude), Number(p.longitude)]}
                  icon={partnerPin}
                >
                  <Popup>
                    <p className="text-xs font-bold">{p.name}</p>
                    <p className="text-[11px] text-charcoal-muted">
                      {p.category_display} · {p.availability?.status}
                    </p>
                  </Popup>
                </Marker>
              ))}
              {data?.map_overview.reports.map((r) => (
                <Marker
                  key={r.id}
                  position={[Number(r.latitude), Number(r.longitude)]}
                  icon={reportPin}
                >
                  <Popup>
                    <p className="text-xs font-bold">{r.area_label}</p>
                    <p className="text-[11px] text-charcoal-muted">
                      {r.category_display} · {r.review_status_display}
                    </p>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </Card>

        <Card surface="matte" className="space-y-4 p-6 lg:col-span-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-charcoal">
              AI Safety Intelligence Digest
            </h2>
            <Link
              to="/admin/reports"
              className="inline-flex items-center gap-1 text-xs font-semibold text-mint-deep hover:underline"
            >
              Full Report
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ul className="space-y-2 text-xs text-charcoal">
            {data?.intelligence.summary_notes.map((n) => (
              <li key={n} className="rounded-xl bg-warm-white p-3 leading-relaxed">
                {n}
              </li>
            ))}
          </ul>
          <p className="text-[11px] leading-relaxed text-charcoal-muted">
            {data?.intelligence.methodology_and_limitations}
          </p>
        </Card>
      </div>

      {/* Request Monitoring Table */}
      <Card surface="matte" className="overflow-hidden">
        <div className="border-b border-border-soft px-5 py-4">
          <h2 className="font-display text-base font-bold text-charcoal">
            Recent Assistance Request Monitoring
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border-soft bg-warm-white uppercase tracking-wider text-charcoal-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Establishment</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Created</th>
                <th className="px-5 py-3 font-semibold">Partner Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {!data || data.recent_requests.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-center text-charcoal-muted">
                    No assistance requests logged yet.
                  </td>
                </tr>
              ) : (
                data.recent_requests.map((req) => (
                  <tr key={req.id}>
                    <td className="px-5 py-3 font-semibold text-charcoal">
                      {req.partner_name}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={req.status === 'CLOSED' ? 'violet' : 'mint'}>
                        {req.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-charcoal-muted">
                      {new Date(req.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-charcoal-muted">
                      {req.partner_response_note || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Immutable Audit History */}
      <Card surface="matte" className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border-soft px-5 py-4">
          <ScrollText className="h-4 w-4 text-mint-deep" />
          <h2 className="font-display text-base font-bold text-charcoal">
            Governance &amp; Security Audit History
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border-soft bg-warm-white uppercase tracking-wider text-charcoal-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">Summary</th>
                <th className="px-4 py-3 font-semibold">Actor</th>
                <th className="px-5 py-3 font-semibold">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {data?.audit_logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-5 py-3 font-mono text-[11px] font-semibold text-charcoal">
                    {log.action}
                  </td>
                  <td className="px-4 py-3 text-charcoal-muted">{log.summary}</td>
                  <td className="px-4 py-3 text-charcoal-muted">{log.actor_email}</td>
                  <td className="px-5 py-3 text-charcoal-muted">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </DashboardLayout>
  );
}
