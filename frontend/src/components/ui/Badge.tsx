import type { ReactNode } from 'react';

type BadgeTone = 'mint' | 'pink' | 'violet' | 'blue' | 'warning' | 'error' | 'neutral';

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

const toneClasses: Record<BadgeTone, string> = {
  mint: 'bg-mint-soft text-mint-deep border-mint-dark/40',
  pink: 'bg-[var(--color-pink-soft)] text-[#9b2c63] border-[var(--color-pink)]/40',
  violet: 'bg-[var(--color-violet-soft)] text-[#51379c] border-[var(--color-violet)]/40',
  blue: 'bg-[var(--color-blue-soft)] text-[#1c598a] border-[var(--color-blue)]/45',
  warning:
    'bg-[var(--color-warning-soft)] text-[var(--color-warning-deep)] border-[var(--color-warning)]',
  error:
    'bg-[var(--color-error-soft)] text-[var(--color-error-deep)] border-[var(--color-error)]',
  neutral: 'bg-warm-surface text-charcoal-muted border-border-soft',
};

export function Badge({ tone = 'mint', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide ${toneClasses[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
