'use client';

import type { LucideIcon } from 'lucide-react';

export type StatCardProps = {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  accentColor: string;
};

const panelClass =
  'rounded-2xl border border-white/6 bg-[var(--workspace-shell-panel)] shadow-[0_12px_36px_rgba(4,10,24,0.18)]';

export function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  accentColor,
}: StatCardProps) {
  return (
    <div className={panelClass}>
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
          >
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--workspace-shell-text-muted)]">
            {label}
          </span>
        </div>
        <p className="text-2xl font-semibold tracking-tight text-white">
          {value}
        </p>
        {subtitle && (
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
