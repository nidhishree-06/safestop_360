import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Ban, RefreshCw } from 'lucide-react';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/context/ToastContext';
import { ApiError, fetchAdminCompanions, reviewAdminCompanion } from '@/services/api';
import type { CompanionItem } from '@/types';

export function AdminCompanionsPage() {
  const { pushToast } = useToast();
  const [companions, setCompanions] = useState<CompanionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAdminCompanions();
      setCompanions(res.results);
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Failed to load companion applications',
        description: err instanceof ApiError ? err.message : 'Check admin session.',
      });
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDecision = async (
    id: string,
    decision: 'APPROVED' | 'REJECTED' | 'SUSPENDED'
  ) => {
    setBusyId(id);
    try {
      const updated = await reviewAdminCompanion(id, decision);
      setCompanions((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      pushToast({
        tone: 'success',
        title: `Companion ${decision}`,
        description: `${updated.display_name} updated and recorded in audit log.`,
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Action failed',
        description: err instanceof ApiError ? err.message : 'Try again.',
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardLayout
      title="Companion Verification"
      subtitle="Approve or reject companion registrations. Only APPROVED companions appear to SafeStop users."
    >
      <div className="flex justify-end">
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
                <th className="px-5 py-3.5 font-semibold">Companion</th>
                <th className="px-4 py-3.5 font-semibold">Service Areas</th>
                <th className="px-4 py-3.5 font-semibold">Status</th>
                <th className="px-5 py-3.5 text-right font-semibold">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-xs text-charcoal-muted">
                    Loading companion queue...
                  </td>
                </tr>
              ) : companions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-xs text-charcoal-muted">
                    No companion profiles registered yet.
                  </td>
                </tr>
              ) : (
                companions.map((comp) => (
                  <tr key={comp.id} className="hover:bg-warm-white/60">
                    <td className="px-5 py-4">
                      <p className="font-display text-sm font-bold text-charcoal">
                        {comp.display_name}
                      </p>
                      <p className="text-xs text-charcoal-muted">{comp.user_email}</p>
                    </td>
                    <td className="px-4 py-4 text-xs text-charcoal-muted">
                      {comp.service_areas.join(', ')}
                    </td>
                    <td className="px-4 py-4">
                      <Badge
                        tone={
                          comp.verification_status === 'APPROVED'
                            ? 'mint'
                            : comp.verification_status === 'PENDING'
                              ? 'warning'
                              : 'error'
                        }
                      >
                        {comp.verification_status}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1.5">
                        {comp.verification_status !== 'APPROVED' && (
                          <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            disabled={busyId === comp.id}
                            onClick={() => handleDecision(comp.id, 'APPROVED')}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Approve
                          </Button>
                        )}
                        {comp.verification_status === 'PENDING' && (
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            disabled={busyId === comp.id}
                            onClick={() => handleDecision(comp.id, 'REJECTED')}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                          </Button>
                        )}
                        {comp.verification_status === 'APPROVED' && (
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            disabled={busyId === comp.id}
                            onClick={() => handleDecision(comp.id, 'SUSPENDED')}
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
    </DashboardLayout>
  );
}
