import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Circle, MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import {
  Activity,
  Building2,
  ClipboardCheck,
  FileText,
  Megaphone,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge, Button, Card, Skeleton } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import {
  createVerifiedPartnerIcon,
  MAP_TILE_ATTRIBUTION,
  MAP_TILE_URL,
  MYSURU_DEFAULT_CENTER,
} from '@/lib/leaflet';
import { ApiError, fetchAdminAnalytics } from '@/services/api';
import type { AdminAnalyticsResponse } from '@/types';

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
        title: 'Could not load admin analytics',
        description: err instanceof ApiError ? err.message : 'Verify admin access.',
      });
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const c = data?.counts;

  return (
    <DashboardLayout
      title="Administrator Governance & Overview"
      subtitle="Platform analytics, Mysuru SafePlaces & rounded report overview map, request monitoring, and immutable audit logs."
    >
      {loading || !data || !c ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI Summary Strip */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <div className="flex items-center justify-between text-xs text-charcoal-muted">
                <span>Approved Partners</span>
                <Building2 className="h-4 w-4 text-mint-deep" />
              </div>
              <p className="mt-2 font-display text-2xl font-extrabold text-charcoal tabular-nums">
                {c.partners_approved}
              </p>
              <p className="mt-1 text-xs text-charcoal-muted">
                {c.partners_pending} pending · {c.partners_available_now} available now
              </p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between text-xs text-charcoal-muted">
                <span>Assistance Requests</span>
                <Activity className="h-4 w-4 text-mint-deep" />
              </div>
              <p className="mt-2 font-display text-2xl font-extrabold text-charcoal tabular-nums">
                {c.requests_total}
              </p>
              <p className="mt-1 text-xs text-charcoal-muted">
                {c.requests_active} active · {c.requests_closed} closed
              </p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between text-xs text-charcoal-muted">
                <span>Community Reports</span>
                <Megaphone className="h-4 w-4 text-[var(--color-pink)]" />
              </div>
              <p className="mt-2 font-display text-2xl font-extrabold text-charcoal tabular-nums">
                {c.reports_total}
              </p>
              <p className="mt-1 text-xs text-charcoal-muted">
                {c.reports_unreviewed} unreviewed · {data.intelligence.repeat_areas_count} repeat
                area(s)
              </p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between text-xs text-charcoal-muted">
                <span>Companions &amp; Users</span>
                <Users className="h-4 w-4 text-mint-deep" />
              </div>
              <p className="mt-2 font-display text-2xl font-extrabold text-charcoal tabular-nums">
                {c.users_total}
              </p>
              <p className="mt-1 text-xs text-charcoal-muted">
                {c.companions_approved} verified · {c.companions_pending} pending companions
              </p>
            </Card>
          </div>

          {/* Quick Governance Navigation */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Link to="/admin/partners">
              <Button size="sm" variant="primary">
                <ClipboardCheck className="h-4 w-4" />
                Partner Approvals ({c.partners_pending})
              </Button>
            </Link>
            <Link to="/admin/reports">
              <Button size="sm" variant="secondary">
                <Megaphone className="h-4 w-4" />
                Report Moderation ({c.reports_unreviewed})
              </Button>
            </Link>
            <Link to="/admin/companions">
              <Button size="sm" variant="secondary">
                <Users className="h-4 w-4" />
                Companion Reviews ({c.companions_pending})
              </Button>
            </Link>
            <Button size="sm" variant="ghost" onClick={() => void loadAnalytics()}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>

          {/* Network Map Overview (Verified Partners + Rounded 300 m Report Clusters) */}
          <Card className="space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-charcoal">
                Verified Partners &amp; Grouped Report Clusters (Mysuru)
              </h2>
              <Badge tone="neutral">Private user journeys excluded by design</Badge>
            </div>
            <div className="h-80 w-full overflow-hidden rounded-control border border-border-soft">
              <MapContainer
                center={[MYSURU_DEFAULT_CENTER.lat, MYSURU_DEFAULT_CENTER.lng]}
                zoom={13}
                className="h-full w-full"
              >
                <TileLayer url={MAP_TILE_URL} attribution={MAP_TILE_ATTRIBUTION} maxZoom={19} />
                {data.map_overview.partners.map((p) => (
                  <Marker
                    key={p.id}
                    position={[Number(p.latitude), Number(p.longitude)]}
                    icon={createVerifiedPartnerIcon(p.category)}
                  >
                    <Popup>
                      <strong>{p.name}</strong>
                      <br />
                      {p.category_display} · {p.availability?.status_display || 'Offline'}
                    </Popup>
                  </Marker>
                ))}
                {data.intelligence.clusters.map((cluster) => (
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
                      <strong>{cluster.area_label}</strong>
                      <br />
                      {cluster.summary_statement}
                    </Popup>
                  </Circle>
                ))}
              </MapContainer>
            </div>
          </Card>

          {/* Rule-Based Analysis Digest + Request Monitoring */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="space-y-3 p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-mint-deep" />
                <h2 className="font-display text-base font-bold text-charcoal">
                  300 m Area Observations
                </h2>
              </div>
              <p className="text-xs text-charcoal-muted">{data.intelligence.non_claim_notice}</p>
              <div className="space-y-2">
                {data.intelligence.clusters.slice(0, 4).map((cl) => (
                  <div
                    key={cl.cluster_id}
                    className="rounded-control border border-border-soft bg-warm-white p-3 text-xs"
                  >
                    <p className="font-bold text-charcoal">{cl.area_label}</p>
                    <p className="font-semibold text-mint-deep">{cl.summary_statement}</p>
                    <p className="text-charcoal-muted">{cl.explanation}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="space-y-3 p-5">
              <h2 className="font-display text-base font-bold text-charcoal">
                Recent Help Requests ({data.recent_requests.length})
              </h2>
              {data.recent_requests.length === 0 ? (
                <p className="text-xs text-charcoal-muted">No help requests recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {data.recent_requests.slice(0, 6).map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between gap-2 rounded-control border border-border-soft bg-warm-white p-3 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-bold text-charcoal">{req.partner_name}</p>
                        <p className="text-charcoal-muted">
                          {req.requester_name} · {new Date(req.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Badge tone={req.status === 'CLOSED' ? 'mint' : 'warning'}>
                        {req.status_display}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Immutable Audit Log */}
          <Card className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-mint-deep" />
              <h2 className="font-display text-base font-bold text-charcoal">
                Immutable Audit Log ({data.audit_logs.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border-soft text-charcoal-muted">
                  <tr>
                    <th className="py-2 pr-3 font-semibold">Action</th>
                    <th className="py-2 pr-3 font-semibold">Actor</th>
                    <th className="py-2 pr-3 font-semibold">Summary</th>
                    <th className="py-2 font-semibold">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft/70">
                  {data.audit_logs.slice(0, 15).map((log) => (
                    <tr key={log.id}>
                      <td className="py-2 pr-3 font-mono text-[11px] font-semibold text-mint-deep">
                        {log.action}
                      </td>
                      <td className="py-2 pr-3 text-charcoal">{log.actor_email}</td>
                      <td className="py-2 pr-3 text-charcoal-muted">{log.summary}</td>
                      <td className="py-2 whitespace-nowrap text-charcoal-muted">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
