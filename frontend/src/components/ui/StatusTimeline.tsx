import { Check } from 'lucide-react';

export interface TimelineStep {
  id: string;
  label: string;
  detail?: string;
  state: 'completed' | 'current' | 'upcoming' | 'cancelled';
}

interface StatusTimelineProps {
  steps: TimelineStep[];
  className?: string;
}

export function StatusTimeline({ steps, className = '' }: StatusTimelineProps) {
  return (
    <ol className={`space-y-3 ${className}`} aria-label="Status progress">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <li key={step.id} className="relative flex items-start gap-3">
            {!isLast && (
              <span
                aria-hidden="true"
                className={`absolute left-3 top-6 h-[calc(100%-0.5rem)] w-0.5 ${
                  step.state === 'completed' ? 'bg-mint-dark' : 'bg-border-soft'
                }`}
              />
            )}
            <span
              className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                step.state === 'completed'
                  ? 'border-mint-dark bg-mint text-mint-deep'
                  : step.state === 'current'
                    ? 'border-mint-dark bg-mint-soft text-mint-deep ring-4 ring-mint/40'
                    : step.state === 'cancelled'
                      ? 'border-[var(--color-error)] bg-[var(--color-error-soft)] text-[var(--color-error-deep)]'
                      : 'border-border-soft bg-white text-charcoal-muted'
              }`}
            >
              {step.state === 'completed' ? (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                index + 1
              )}
            </span>
            <div className="min-w-0 flex-1 pb-1">
              <p
                className={`text-sm font-semibold ${
                  step.state === 'upcoming' ? 'text-charcoal-muted' : 'text-charcoal'
                }`}
              >
                {step.label}
              </p>
              {step.detail && <p className="mt-0.5 text-xs text-charcoal-muted">{step.detail}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
