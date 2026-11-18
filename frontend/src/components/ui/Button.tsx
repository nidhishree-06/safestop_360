import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'neu-btn-primary font-semibold text-charcoal',
  secondary: 'neu-btn-secondary font-medium text-charcoal',
  ghost:
    'rounded-full text-charcoal-muted hover:bg-warm-surface hover:text-charcoal transition-colors font-medium',
  danger:
    'rounded-full bg-[var(--color-error-soft)] text-[var(--color-error-deep)] border border-[var(--color-error)] hover:bg-[var(--color-error)]/30 font-semibold transition-colors',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-xs gap-1.5',
  md: 'px-5 py-2.5 text-sm gap-2',
  lg: 'px-7 py-3.5 text-base gap-2.5',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={`inline-flex items-center justify-center whitespace-nowrap disabled:opacity-55 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
