import { useCallback, useEffect, useState } from 'react';
import { Brain, RefreshCw, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/context/ToastContext';
import { ApiError, fetchAdminReports, reviewAdminReport } from '@/services/api';
import type {
  SafetyIntelligenceSummary,
  SafetyReportItem,
  SafetyReportReviewStatus,
} from '@/types';

const REVIEW_FILTERS: Array<'ALL' | SafetyReportReviewStatus> = [
  'ALL',
  'UNREVIEWED',
  'UNDER_REVIEW',
  'REVIEWED',
  'DISMISSED',
];

export function AdminReportsPage() {
  const { pushToast } = useToast();
  const [reports, setReports] = useState<SafetyReportItem[]>([]);
  const [intelligence, setIntelligence] = useState<SafetyIntelligenceSummary | null>(null);
  const [filter, setFilter] = useState<'ALL' | SafetyReportReviewStatus>('ALL');
  const [loading, setLoading] = useState(true);

  const [selectedReport, setSelectedReport] = useState<SafetyReportItem | null>(null);
  const [nextStatus, setNextStatus] = useState<SafetyReportReviewStatus>('REVIEWED');
  const [adminNotes, setAdminNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAdminReports(filter);
      setReports(res.results);
      setIntelligence(res.intelligence);
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Could not load admin reports',
        description: err instanceof ApiError ? err.message : 'Check admin session.',
      });
    } finally {
      setLoading(false);
    }
  }, [filter, pushToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleReviewSave = async () => {
    if (!selectedReport) return;
    setSaving(true);
    try {
      await reviewAdminReport(selectedReport.id, nextStatus, adminNotes.trim());
      pushToast({
        tone: 'success',
        title: `Report marked ${nextStatus.replace(/_/g, ' ')}`,
      });
      setSelectedReport(null);
      loadData();
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Review update failed',
        description: err instanceof ApiError ? err.message : 'Try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout
      title="Safety Reports & Explainable AI Intelligence"
      subtitle="Moderate community reports and inspect rule-based spatial clusters, category patterns, and time-of-day trends."
    >
      {/* Explainable Rule-Based AI Safety Intelligence Section */}
      {intelligence && (
        <div className="grid gap-6 lg:grid-cols-12">
          <Card surface="matte" className="space-y-4 p-6 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-[#51379c]" />
                <h2 className="font-display text-lg font-bold text-charcoal">
                  Rule-Based Pattern Summary
                </h2>
              </div>
              <Badge tone="violet">
                {intelligence.total_active_reports} Active Report(s)
              </Badge>
            </div>

            <ul className="space-y-2 text-sm text-charcoal">
              {intelligence.summary_notes.map((note) => (
                <li
                  key={note}
                  className="rounded-xl bg-warm-white px-3.5 py-2.5 text-xs leading-relaxed"
                >
                  {note}
                </li>
              ))}
            </ul>

            {/* Category Distribution */}
            <div className="space-y-2.5 pt-2">
              <p className="text-xs font-bold uppercase tracking-wider text-charcoal-muted">
                Category Distribution
              </p>
              {intelligence.category_distribution.map((row) => (
                <div key={row.category} className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <span>{row.label}</span>
                    <span className="tabular-nums text-charcoal-muted">
                      {row.count} ({row.percentage}%)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-warm-surface">
                    <div
                      className="h-full rounded-full bg-mint-dark"
                      style={{ width: `${Math.max(4, row.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <p className="rounded-2xl border border-border-soft bg-warm-white p-3.5 text-[11px] leading-relaxed text-charcoal-muted">
              <strong>Transparency &amp; Limitations:</strong>{' '}
              {intelligence.methodology_and_limitations}
            </p>
          </Card>

          <div className="space-y-6 lg:col-span-5">
            {/* Repeated Clusters */}
            <Card surface="matte" className="space-y-3 p-6">
              <h3 className="font-display text-base font-bold text-charcoal">
                Repeated Nearby Clusters (≤ 500m)
              </h3>
              {intelligence.repeated_report_clusters.length === 0 ? (
                <p className="text-xs text-charcoal-muted">
                  No multi-report clusters currently detected within 500m.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {intelligence.repeated_report_clusters.map((cluster) => (
                    <div
                      key={cluster.cluster_id}
                      className="rounded-2xl border border-[var(--color-violet)]/35 bg-[var(--color-violet-soft)]/50 p-3.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-charcoal">
                          {cluster.primary_area}
                        </span>
                        <Badge tone="violet">{cluster.report_count} reports</Badge>
                      </div>
                      <p className="mt-1 text-charcoal-muted">
                        Dominant: {cluster.dominant_category.replace(/_/g, ' ')} ·{' '}
                        {cluster.unreviewed_count} unreviewed
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Time-of-Day Trends */}
            <Card surface="matte" className="space-y-3 p-6">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-mint-deep" />
                <h3 className="font-display text-base font-bold text-charcoal">
                  Time-of-Day Report Trends
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {intelligence.time_of_day_trends.map((t) => (
                  <div
                    key={t.window}
                    className="rounded-2xl bg-warm-white p-3 text-center"
                  >
                    <p className="font-display text-2xl font-extrabold text-charcoal tabular-nums">
                      {t.count}
                    </p>
                    <p className="mt-0.5 text-[11px] text-charcoal-muted">{t.window}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Report Moderation Table */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {REVIEW_FILTERS.map((rf) => (
            <button
              key={rf}
              type="button"
              onClick={() => setFilter(rf)}
              className={`neu-chip px-3.5 py-1.5 text-xs font-semibold ${
                filter === rf ? 'neu-chip-active' : ''
              }`}
            >
              {rf.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={loadData}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card surface="matte" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-soft bg-warm-white text-xs uppercase tracking-wider text-charcoal-muted">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Area &amp; Observation</th>
                <th className="px-4 py-3.5 font-semibold">Category &amp; AI Themes</th>
                <th className="px-4 py-3.5 font-semibold">Review Status</th>
                <th className="px-4 py-3.5 font-semibold">Submitted</th>
                <th className="px-5 py-3.5 text-right font-semibold">Moderate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-xs text-charcoal-muted">
                    Loading safety reports...
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-xs text-charcoal-muted">
                    No reports in this filter.
                  </td>
                </tr>
              ) : (
                reports.map((rep) => (
                  <tr key={rep.id} className="hover:bg-warm-white/60">
                    <td className="max-w-md px-5 py-4">
                      <p className="font-display text-sm font-bold text-charcoal">
                        {rep.area_label}
                      </p>
                      <p className="mt-0.5 text-xs text-charcoal-muted">{rep.description}</p>
                    </td>
                    <td className="px-4 py-4 text-xs">
                      <p className="font-semibold text-charcoal">{rep.category_display}</p>
                      <p className="text-[#51379c]">
                        {rep.ai_classification?.matched_themes.join(', ')}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <Badge
                        tone={
                          rep.review_status === 'REVIEWED'
                            ? 'mint'
                            : rep.review_status === 'UNDER_REVIEW'
                              ? 'blue'
                              : rep.review_status === 'DISMISSED'
                                ? 'neutral'
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
                    </td>
                    <td className="px-4 py-4 text-xs text-charcoal-muted">
                      {new Date(rep.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setSelectedReport(rep);
                          setNextStatus(
                            rep.review_status === 'UNREVIEWED' ? 'REVIEWED' : rep.review_status
                          );
                          setAdminNotes(rep.admin_notes || '');
                        }}
                      >
                        Review
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={Boolean(selectedReport)}
        onClose={() => setSelectedReport(null)}
        title="Moderate Safety Report"
        subtitle={selectedReport?.area_label}
      >
        <div className="space-y-4">
          <p className="rounded-2xl bg-warm-white p-3.5 text-xs text-charcoal">
            {selectedReport?.description}
          </p>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-charcoal">
              Review Status
            </label>
            <select
              value={nextStatus}
              onChange={(e) =>
                setNextStatus(e.target.value as SafetyReportReviewStatus)
              }
              className="neu-input-pill w-full px-3.5 py-2.5 text-sm text-charcoal focus:outline-none"
            >
              <option value="UNREVIEWED">Unreviewed</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="REVIEWED">Reviewed</option>
              <option value="DISMISSED">Dismissed</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-charcoal">
              Administrator Notes
            </label>
            <textarea
              rows={3}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Document review action or escalation notes..."
              className="neu-input-pill w-full px-3.5 py-2.5 text-sm text-charcoal focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setSelectedReport(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="primary"
              disabled={saving}
              onClick={handleReviewSave}
            >
              {saving ? 'Saving...' : 'Save Review'}
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
