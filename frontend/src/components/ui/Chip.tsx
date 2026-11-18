import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

export function Chip({
  selected = false,
  icon,
  className = '',
  children,
  ...rest
}: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold ${
        selected ? 'neu-chip-active' : 'neu-chip hover:border-mint-dark/60'
      } disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...rest}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}
