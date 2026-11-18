import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`surface-matte-subtle flex flex-col items-center justify-center px-6 py-10 text-center ${className}`}
    >
      {icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-mint-soft text-mint-deep">
          {icon}
        </div>
      )}
      <h3 className="font-display text-base font-bold text-charcoal">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-charcoal-muted">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
