import { ShieldCheck } from 'lucide-react';

interface BrandLogoProps {
  compact?: boolean;
}

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      <span
        className="flex h-10 w-10 items-center justify-center rounded-2xl border border-mint-dark/40 bg-gradient-to-br from-mint via-mint-soft to-white shadow-neu-mint"
        aria-hidden="true"
      >
        <ShieldCheck className="h-5 w-5 text-mint-deep" strokeWidth={2.2} />
      </span>
      {!compact && (
        <div className="flex flex-col leading-none">
          <span className="font-display text-lg font-extrabold tracking-tight text-charcoal">
            SafeStop <span className="text-mint-deep">360</span>
          </span>
          <span className="mt-0.5 text-[11px] font-medium tracking-wide text-charcoal-muted">
            Find Help · Reach Safety
          </span>
        </div>
      )}
    </div>
  );
}
