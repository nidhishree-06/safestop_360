import type { HTMLAttributes, ReactNode } from 'react';

type SurfaceVariant = 'matte' | 'matte-subtle' | 'glass' | 'glass-3d';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  surface?: SurfaceVariant;
  interactive?: boolean;
  children: ReactNode;
}

const surfaceMap: Record<SurfaceVariant, string> = {
  matte: 'surface-matte',
  'matte-subtle': 'surface-matte-subtle',
  glass: 'surface-glass',
  'glass-3d': 'surface-glass-3d',
};

export function Card({
  surface = 'matte',
  interactive = false,
  className = '',
  children,
  ...rest
}: CardProps) {
  const hoverClass =
    interactive && surface === 'matte' ? 'surface-matte-interactive' : '';
  return (
    <div className={`${surfaceMap[surface]} ${hoverClass} ${className}`} {...rest}>
      {children}
    </div>
  );
}
