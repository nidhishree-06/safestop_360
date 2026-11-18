interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  id?: string;
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  id,
}: SwitchProps) {
  const switchId = id || (label ? `switch-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className="flex items-start justify-between gap-3">
      {(label || description) && (
        <div className="min-w-0 flex-1">
          {label && (
            <label
              htmlFor={switchId}
              className="block cursor-pointer text-sm font-semibold text-charcoal"
            >
              {label}
            </label>
          )}
          {description && (
            <p className="mt-0.5 text-xs leading-relaxed text-charcoal-muted">{description}</p>
          )}
        </div>
      )}
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          checked
            ? 'border-mint-dark bg-mint shadow-neu-mint'
            : 'border-border-soft bg-warm-surface'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-elev-1 transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
