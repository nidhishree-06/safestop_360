import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Ban, RefreshCw } from 'lucide-react';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/context/ToastContext';
import { ApiError, fetchAdminPartners, reviewAdminPartner } from '@/services/api';
import type { PartnerOwnerItem, PartnerVerificationStatus } from '@/types';

const STATUS_FILTERS: Array<'ALL' | PartnerVerificationStatus> = [
  'ALL',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
];

export function AdminPartnersPage() {
  const { pushToast } = useToast();
  const [partners, setPartners] = useState<PartnerOwnerItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | PartnerVerificationStatus>('ALL');
  const [loading, setLoading] = useState(true);

  const [reviewTarget, setReviewTarget] = useState<{
    partner: PartnerOwnerItem;
    decision: PartnerVerificationStatus;
  } | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadPartners = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAdminPartners(statusFilter);
      setPartners(res.results);
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Failed to load partner queue',
        description: err instanceof ApiError ? err.message : 'Check admin session.',
      });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, pushToast]);

  useEffect(() => {
    loadPartners();
  }, [loadPartners]);

  const handleConfirmDecision = async () => {
    if (!reviewTarget) return;
    setSubmitting(true);
    try {
      const updated = await reviewAdminPartner(
        reviewTarget.partner.id,
        reviewTarget.decision,
        notes.trim()
      );
      setPartners((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      pushToast({
        tone: 'success',
        title: `Partner ${reviewTarget.decision}`,
        description: `${updated.name} verification status updated and logged.`,
      });
      setReviewTarget(null);
      setNotes('');
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Decision failed',
        description: err instanceof ApiError ? err.message : 'Try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout
      title="Partner Verification Queue"
      subtitle="Approve, reject, or suspend SafeStop partner establishments. Every decision is recorded in the audit trail."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((sf) => (
            <button
              key={sf}
              type="button"
              onClick={() => setStatusFilter(sf)}
              className={`neu-chip px-3.5 py-1.5 text-xs font-semibold ${
                statusFilter === sf ? 'neu-chip-active' : ''
              }`}
            >
              {sf}
            </button>
          ))}
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={loadPartners}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Clean Matte Operational Data Table (zero glass clutter) */}
      <Card surface="matte" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-soft bg-warm-white text-xs uppercase tracking-wider text-charcoal-muted">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Establishment</th>
                <th className="px-4 py-3.5 font-semibold">Category &amp; Area</th>
                <th className="px-4 py-3.5 font-semibold">Coordinator</th>
                <th className="px-4 py-3.5 font-semibold">Status</th>
                <th className="px-4 py-3.5 font-semibold">Availability</th>
                <th className="px-5 py-3.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-xs text-charcoal-muted">
                    Loading partner verification queue...
                  </td>
                </tr>
              ) : partners.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-xs text-charcoal-muted">
                    No partners match the selected status filter.
                  </td>
                </tr>
              ) : (
                partners.map((partner) => (
                  <tr key={partner.id} className="hover:bg-warm-white/60">
                    <td className="px-5 py-4">
                      <p className="font-display text-sm font-bold text-charcoal">
                        {partner.name}
                      </p>
                      <p className="text-xs text-charcoal-muted">{partner.address}</p>
                    </td>
                    <td className="px-4 py-4 text-xs">
                      <p className="font-semibold text-charcoal">{partner.category_display}</p>
                      <p className="text-charcoal-muted">{partner.area || partner.city}</p>
                    </td>
                    <td className="px-4 py-4 text-xs">
                      <p className="font-medium text-charcoal">{partner.owner_name}</p>
                      <p className="text-charcoal-muted">{partner.owner_email}</p>
                    </td>
                    <td className="px-4 py-4">
                      <Badge
                        tone={
                          partner.verification_status === 'APPROVED'
                            ? 'mint'
                            : partner.verification_status === 'PENDING'
                              ? 'warning'
                              : 'error'
                        }
                      >
                        {partner.verification_status}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <Badge tone="neutral">
                        {partner.availability?.status || 'OFFLINE'}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1.5">
                        {partner.verification_status !== 'APPROVED' && (
                          <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            onClick={() => {
                              setReviewTarget({ partner, decision: 'APPROVED' });
                              setNotes('');
                            }}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Approve
                          </Button>
                        )}
                        {partner.verification_status === 'PENDING' && (
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              setReviewTarget({ partner, decision: 'REJECTED' });
                              setNotes('');
                            }}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                          </Button>
                        )}
                        {partner.verification_status === 'APPROVED' && (
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              setReviewTarget({ partner, decision: 'SUSPENDED' });
                              setNotes('');
                            }}
                          >
                            <Ban className="h-3.5 w-3.5" />
                            Suspend
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={Boolean(reviewTarget)}
        onClose={() => setReviewTarget(null)}
        title={`Confirm Partner ${reviewTarget?.decision || ''}`}
        subtitle={reviewTarget?.partner.name}
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-charcoal">
              Verification Notes (saved to audit history)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter inspection notes or reason for decision..."
              className="neu-input-pill w-full px-3.5 py-2.5 text-sm text-charcoal focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setReviewTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant={reviewTarget?.decision === 'APPROVED' ? 'primary' : 'danger'}
              disabled={submitting}
              onClick={handleConfirmDecision}
            >
              {submitting ? 'Saving...' : `Confirm ${reviewTarget?.decision}`}
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
