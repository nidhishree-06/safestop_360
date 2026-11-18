import { PhoneCall, Info } from 'lucide-react';

export function EmergencyBanner() {
  return (
    <aside
      aria-label="Official emergency helpline numbers for India"
      className="surface-matte flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-error-soft)] text-[var(--color-error-deep)]">
          <Info className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-charcoal">
            Official Emergency Services (India)
          </p>
          <p className="text-xs leading-relaxed text-charcoal-muted">
            SafeStop 360 is an independent assistance platform and does not replace official
            emergency services. In immediate danger, call directly:
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <a
          href="tel:112"
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-error)] bg-[var(--color-error-soft)] px-4 py-2 text-xs font-bold text-[var(--color-error-deep)] hover:bg-[var(--color-error)]/30"
        >
          <PhoneCall className="h-3.5 w-3.5" aria-hidden="true" />
          Emergency: 112
        </a>
        <a
          href="tel:181"
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-pink)]/50 bg-[var(--color-pink-soft)] px-4 py-2 text-xs font-bold text-[#9b2c63] hover:bg-[var(--color-pink)]/20"
        >
          <PhoneCall className="h-3.5 w-3.5" aria-hidden="true" />
          Women Helpline: 181
        </a>
      </div>
    </aside>
  );
}
