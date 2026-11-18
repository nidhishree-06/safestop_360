import { Link } from 'react-router-dom';
import { PhoneCall, ShieldCheck } from 'lucide-react';

import { BrandLogo } from '@/components/ui/BrandLogo';

export function Footer() {
  return (
    <footer className="mt-20 border-t border-border-soft bg-pure-white/80">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="space-y-4 md:col-span-2">
            <BrandLogo />
            <p className="max-w-md text-sm leading-relaxed text-charcoal-muted">
              SafeStop 360 connects women with verified nearby establishments, opt-in
              Journey Watch check-ins, and transparent community safety intelligence.
            </p>
            <div className="inline-flex items-center gap-2 rounded-full border border-border-soft bg-warm-white px-3.5 py-1.5 text-xs font-medium text-charcoal-muted">
              <ShieldCheck className="h-3.5 w-3.5 text-mint-deep" aria-hidden="true" />
              Privacy-first · Opt-in location · No public user tracking
            </div>
          </div>

          <div>
            <h3 className="font-display text-sm font-bold text-charcoal">Platform</h3>
            <ul className="mt-3 space-y-2 text-sm text-charcoal-muted">
              <li>
                <Link to="/find-help" className="hover:text-charcoal">
                  Find Nearby Assistance
                </Link>
              </li>
              <li>
                <a href="/#how-it-works" className="hover:text-charcoal">
                  How SafeStop Works
                </a>
              </li>
              <li>
                <Link to="/resources" className="hover:text-charcoal">
                  Safety Resources
                </Link>
              </li>
              <li>
                <Link to="/register?role=PARTNER" className="hover:text-charcoal">
                  Become a Verified Partner
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-display text-sm font-bold text-charcoal">
              Official India Helplines
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-charcoal-muted">
              SafeStop 360 does not replace official emergency services. For urgent danger:
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <a
                href="tel:112"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-error-deep)] hover:underline"
              >
                <PhoneCall className="h-3.5 w-3.5" aria-hidden="true" />
                112 — National Emergency Response
              </a>
              <a
                href="tel:181"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#9b2c63] hover:underline"
              >
                <PhoneCall className="h-3.5 w-3.5" aria-hidden="true" />
                181 — Women Helpline
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border-soft pt-6 text-xs text-charcoal-muted sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} SafeStop 360. Built for safer, connected journeys.</p>
          <p>Prototype uses clearly labelled [DEMO] Bengaluru establishments for local testing.</p>
        </div>
      </div>
    </footer>
  );
}
