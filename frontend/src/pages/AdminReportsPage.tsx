import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Info, Sparkles } from 'lucide-react';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge, Button, Card, Chip, Skeleton } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { ApiError, fetchAdminReports, reviewAdminReport } from '@/services/api';
import type {
  SafetyIntelligenceSummary,
  SafetyReportItem,
  SafetyReportReviewStatus,
} from '@/types';

const STATUS_FILTERS: Array<'ALL' | SafetyReportReviewStatus> = [
  'ALL',
  'UNREVIEWED',
  'UNDER_REVIEW',
  'REVIEWED',
  'DISMISSED',
];

export function AdminReportsPage() {
  const { pushToast } = useToast();
  const [filter, setFilter] = useState<'ALL' | SafetyReportReviewStatus>('ALL');
  const [reports, setReports] = useState<SafetyReportItem[]>([]);
  const [intel, setIntel] = useState<SafetyIntelligenceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAdminReports(filter);
      setReports(res.results);
      setIntel(res.intelligence);
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Could not load reports',
        description: err instanceof ApiError ? err.message : 'Check admin session.',
      });
    } finally {
      setLoading(false);
    }
  }, [filter, pushToast]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const handleReview = async (id: string, nextStatus: SafetyReportReviewStatus) => {
    setBusyId(id);
    try {
      await reviewAdminReport(id, nextStatus, notesById[id] || '');
      pushToast({ tone: 'success', title: `Report marked ${nextStatus}` });
      await loadReports();
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Review update failed',
        description: err instanceof ApiError ? err.message : 'Please retry.',
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardLayout
      title="Safety Reports & Rule-Based Analysis"
      subtitle="Moderate community safety observations and inspect transparent 300 m spatial clusters."
    >
      {intel && (
        <Card className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-mint-deep" />
              <h2 className="font-display text-base font-bold text-charcoal">
                Rule-Based Report Analysis ({intel.total_reports_analyzed} active reports)
              </h2>
            </div>
            <Badge tone="pink">{intel.repeat_areas_count} repeat area(s) within 300 m</Badge>
          </div>

          <p className="flex items-start gap-2 rounded-control bg-warm-white p-3 text-xs text-charcoal-muted">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-mint-deep" />
            <span>{intel.non_claim_notice}</span>
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-wider text-charcoal-muted">
                Theme Breakdown
              </p>
              {intel.theme_breakdown.map((row) => (
                <div
                  key={row.theme}
                  className="flex items-center justify-between rounded-control bg-warm-white px-3 py-1.5 text-xs"
                >
                  <span className="font-medium text-charcoal">{row.theme}</span>
                  <span className="font-bold text-mint-deep tabular-nums">{row.count}</span>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-wider text-charcoal-muted">
                Time-of-Day Trends
              </p>
              {intel.time_of_day_trends.map((row) => (
                <div
                  key={row.window}
                  className="flex items-center justify-between rounded-control bg-warm-white px-3 py-1.5 text-xs"
                >
                  <span className="font-medium text-charcoal">{row.window}</span>
                  <span className="font-bold text-charcoal tabular-nums">{row.count}</span>
                </div>
              ))}
            </div>
          </div>

          {intel.clusters.length > 0 && (
            <div className="space-y-2 border-t border-border-soft pt-3">
              <p className="text-xs font-bold uppercase tracking-wider text-charcoal-muted">
                300 m Grouped Area Summaries
              </p>
              <div className="grid gap-2.5 md:grid-cols-2">
                {intel.clusters.map((cluster) => (
                  <div
                    key={cluster.cluster_id}
                    className="rounded-control border border-border-soft bg-warm-white p-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-charcoal">{cluster.area_label}</span>
                      {cluster.is_repeat_area && <Badge tone="pink">Repeat</Badge>}
                    </div>
                    <p className="mt-1 font-semibold text-mint-deep">
                      {cluster.summary_statement}
                    </p>
                    <p className="mt-0.5 text-charcoal-muted">{cluster.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((st) => (
          <Chip key={st} selected={filter === st} onClick={() => setFilter(st)}>
            {st.replace('_', ' ')}
          </Chip>
        ))}
      </div>

      {/* Reports Moderation Queue */}
      {loading ? (
        <Skeleton className="h-44 w-full" />
      ) : (
        <div className="space-y-3">
          {reports.map((rep) => (
            <Card key={rep.id} className="space-y-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={rep.is_unreviewed ? 'warning' : 'mint'}>
                    {rep.review_status_display}
                  </Badge>
                  <Badge tone="neutral">{rep.category_display}</Badge>
                  {rep.is_demo && <Badge tone="violet">Demo</Badge>}
                </div>
                <span className="text-xs text-charcoal-muted">
                  {new Date(rep.created_at).toLocaleString()}
                </span>
              </div>

              <div>
                <h3 className="font-display text-base font-bold text-charcoal">
                  {rep.area_label} ({rep.city})
                </h3>
                <p className="mt-1 text-sm text-charcoal-muted">{rep.description}</p>
                {rep.ai_classification && (
                  <p className="mt-1.5 text-xs text-mint-deep">
                    <strong>Matched themes:</strong> {rep.ai_classification.themes.join(', ')} ·{' '}
                    {rep.ai_classification.rationale}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Optional admin moderation note..."
                  value={notesById[rep.id] ?? rep.admin_notes ?? ''}
                  onChange={(e) =>
                    setNotesById((prev) => ({ ...prev, [rep.id]: e.target.value }))
                  }
                  className="neu-input-pill min-w-[220px] flex-1 px-3.5 py-2 text-xs text-charcoal"
                />
                <Button
                  size="sm"
                  variant="primary"
                  disabled={busyId === rep.id}
                  onClick={() => void handleReview(rep.id, 'REVIEWED')}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Mark Reviewed
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busyId === rep.id}
                  onClick={() => void handleReview(rep.id, 'UNDER_REVIEW')}
                >
                  Under Review
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busyId === rep.id}
                  onClick={() => void handleReview(rep.id, 'DISMISSED')}
                >
                  Dismiss
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
