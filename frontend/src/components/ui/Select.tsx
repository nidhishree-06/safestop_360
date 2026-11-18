import type { SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
}

export function Select({
  label,
  error,
  hint,
  options,
  id,
  className = '',
  ...rest
}: SelectProps) {
  const selectId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-charcoal">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          className={`neu-input-pill w-full appearance-none px-4 py-2.5 pr-10 text-sm text-charcoal ${
            error ? 'border-[var(--color-error)]' : ''
          } ${className}`}
          {...rest}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-muted"
          aria-hidden="true"
        />
      </div>
      {error && <p className="text-xs text-[var(--color-error-deep)]">{error}</p>}
      {!error && hint && <p className="text-xs text-charcoal-muted">{hint}</p>}
    </div>
  );
}
