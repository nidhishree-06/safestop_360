import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MapPin,
  ShieldAlert,
  Navigation,
  Users,
  Megaphone,
  PhoneCall,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmergencyBanner } from '@/components/ui/EmergencyBanner';
import { useAuth } from '@/context/AuthContext';
import { fetchDashboardSummary, ApiError } from '@/services/api';
import type { DashboardSummary } from '@/types';

const quickActions = [
  { label: 'Find Nearby Help', to: '/app/map', icon: MapPin, primary: true },
  { label: 'Request Assistance', to: '/app/requests', icon: ShieldAlert },
  { label: 'Start Journey Watch', to: '/app/journey', icon: Navigation },
  { label: 'Report an Area', to: '/app/reports', icon: Megaphone },
  { label: 'Emergency Support', to: '/resources', icon: PhoneCall },
];

export function WomanDashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchDashboardSummary()
      .then((res) => {
        if (active) setSummary(res);
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof ApiError
              ? err.message
              : 'Could not load dashboard summary.'
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const firstName = user?.full_name?.split(' ')[0] || 'there';

  return (
    <DashboardLayout
      title={`Welcome back, ${firstName}`}
      subtitle={`Your personal safety hub in ${user?.profile?.city || 'Bengaluru'} — calm, private, and ready whenever you need support.`}
    >
      {/* Quick Actions Strip */}
      <Card surface="glass" className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-charcoal-muted">
            Quick Actions
          </span>
          <div className="flex flex-wrap gap-2.5">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.label} to={action.to}>
                  <Button
                    type="button"
                    size="sm"
                    variant={action.primary ? 'primary' : 'secondary'}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {action.label}
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>
      </Card>

      {error && (
        <Card surface="matte" className="border-[var(--color-error)] p-4 text-xs text-[var(--color-error-deep)]">
          {error}
        </Card>
      )}

      {/* 4 Real-Data Status Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Card surface="matte" interactive className="h-full p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-charcoal-muted">
                Verified SafeStops
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint-soft text-mint-deep">
                <MapPin className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <p className="mt-3 font-display text-3xl font-extrabold text-charcoal tabular-nums">
              {loading ? '—' : summary?.approved_partners_count ?? 0}
            </p>
            <p className="mt-1 text-xs text-charcoal-muted">
              {loading
                ? 'Loading availability...'
                : `${summary?.available_partners_count ?? 0} currently AVAILABLE`}
            </p>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
          <Card surface="matte" interactive className="h-full p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-charcoal-muted">
                Help Request Status
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-violet-soft)] text-[#51379c]">
                <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-3">
              {summary?.active_help_request ? (
                <>
                  <Badge tone="mint">{summary.active_help_request.status}</Badge>
                  <p className="mt-2 truncate text-xs font-semibold text-charcoal">
                    {summary.active_help_request.partner_name}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-display text-xl font-bold text-charcoal">No Active Request</p>
                  <p className="mt-1 text-xs text-charcoal-muted">
                    Select any verified partner to start the loop.
                  </p>
                </>
              )}
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
          <Card surface="matte" interactive className="h-full p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-charcoal-muted">
                Journey Watch
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-blue-soft)] text-[#1c598a]">
                <Navigation className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-3">
              {summary?.active_journey ? (
                <>
                  <Badge tone={summary.active_journey.status === 'OVERDUE' ? 'warning' : 'blue'}>
                    {summary.active_journey.status}
                  </Badge>
                  <p className="mt-2 truncate text-xs font-semibold text-charcoal">
                    To: {summary.active_journey.destination_label}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-display text-xl font-bold text-charcoal">Not Travelling</p>
                  <p className="mt-1 text-xs text-charcoal-muted">
                    Opt-in private check-ins anytime.
                  </p>
                </>
              )}
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
          <Card surface="matte" interactive className="h-full p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-charcoal-muted">
                Trusted Contacts
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-pink-soft)] text-[#9b2c63]">
                <Users className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <p className="mt-3 font-display text-3xl font-extrabold text-charcoal tabular-nums">
              {loading ? '—' : summary?.trusted_contacts_count ?? 0}
            </p>
            <p className="mt-1 text-xs text-charcoal-muted">
              Ready for opt-in Journey Watch alerts
            </p>
          </Card>
        </motion.div>
      </div>

      {/* Main Detail Panels */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Trusted Contacts Preview */}
        <Card surface="matte" className="space-y-4 p-6 lg:col-span-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-charcoal">
              Trusted Contacts
            </h2>
            <Link
              to="/app/journey"
              className="inline-flex items-center gap-1 text-xs font-semibold text-mint-deep hover:underline"
            >
              Manage
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {summary && summary.trusted_contacts.length > 0 ? (
            <ul className="space-y-2.5">
              {summary.trusted_contacts.map((contact) => (
                <li
                  key={contact.id}
                  className="flex items-center justify-between rounded-2xl border border-border-soft bg-warm-white px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-charcoal">{contact.name}</p>
                    <p className="text-xs text-charcoal-muted">
                      {contact.relationship || 'Trusted Contact'} · {contact.phone}
                    </p>
                  </div>
                  {contact.is_primary && <Badge tone="mint">Primary</Badge>}
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-border-soft bg-warm-white p-5 text-center">
              <p className="text-sm font-semibold text-charcoal">No trusted contacts yet</p>
              <p className="mt-1 text-xs text-charcoal-muted">
                Add family or friends to select during Journey Watch check-ins.
              </p>
              <Link to="/app/journey" className="mt-3 inline-block">
                <Button size="sm" variant="primary" type="button">
                  Add Trusted Contact
                </Button>
              </Link>
            </div>
          )}
        </Card>

        {/* Recent Community Safety Reports */}
        <Card surface="matte" className="space-y-4 p-6 lg:col-span-7">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-charcoal">
                Recent Community Safety Reports
              </h2>
              <p className="text-xs text-charcoal-muted">
                Reporter identities are never shown publicly. Unreviewed items are clearly marked.
              </p>
            </div>
            <Link
              to="/app/reports"
              className="inline-flex items-center gap-1 text-xs font-semibold text-mint-deep hover:underline"
            >
              View All
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {summary && summary.recent_reports.length > 0 ? (
            <div className="space-y-2.5">
              {summary.recent_reports.map((report) => (
                <div
                  key={report.id}
                  className="flex flex-col justify-between gap-2 rounded-2xl border border-border-soft bg-warm-white px-4 py-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-charcoal">
                      {report.area_label}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-charcoal-muted">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {report.category.replace(/_/g, ' ')} · {report.city}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge
                      tone={
                        report.review_status === 'REVIEWED'
                          ? 'mint'
                          : report.review_status === 'UNDER_REVIEW'
                            ? 'blue'
                            : 'warning'
                      }
                    >
                      {report.review_status === 'REVIEWED' ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <AlertTriangle className="h-3 w-3" />
                      )}
                      {report.review_status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-charcoal-muted">No recent safety reports recorded.</p>
          )}
        </Card>
      </div>

      <EmergencyBanner />
    </DashboardLayout>
  );
}
