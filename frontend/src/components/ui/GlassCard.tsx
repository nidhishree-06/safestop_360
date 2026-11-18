import type { HTMLAttributes, ReactNode } from 'react';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  children: ReactNode;
}

export function GlassCard({
  elevated = false,
  className = '',
  children,
  ...rest
}: GlassCardProps) {
  return (
    <div
      className={`${elevated ? 'surface-glass-3d' : 'surface-glass'} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
