import type { ReactNode } from 'react';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  badge?: string | number;
  icon?: ReactNode;
}

interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
  ariaLabel?: string;
}

export function Tabs<T extends string = string>({
  tabs,
  active,
  onChange,
  className = '',
  ariaLabel = 'Section tabs',
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`neu-tab-track inline-flex flex-wrap items-center gap-1 ${className}`}
    >
      {tabs.map((tab) => {
        const isSelected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onChange(tab.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              isSelected
                ? 'bg-white text-charcoal shadow-elev-1 ring-1 ring-mint-dark/30'
                : 'text-charcoal-muted hover:text-charcoal'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span className="rounded-full bg-mint-soft px-1.5 py-0.5 text-[10px] font-bold text-mint-deep tabular-nums">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
