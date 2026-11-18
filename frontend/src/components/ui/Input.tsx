import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leftIcon, rightSlot, id, className = '', ...rest },
  ref
) {
  const inputId = id || rest.name;
  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold tracking-wide text-charcoal"
        >
          {label}
        </label>
      )}
      <div
        className={`neu-input-pill flex items-center gap-2 px-3.5 py-2.5 ${
          error ? 'border-[var(--color-error)]' : ''
        } ${className}`}
      >
        {leftIcon && (
          <span className="shrink-0 text-charcoal-muted" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className="w-full bg-transparent text-sm text-charcoal placeholder:text-charcoal-muted/70 focus:outline-none"
          {...rest}
        />
        {rightSlot && <div className="shrink-0">{rightSlot}</div>}
      </div>
      {error ? (
        <p className="text-xs font-medium text-[var(--color-error-deep)]" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-charcoal-muted">{hint}</p>
      ) : null}
    </div>
  );
});
