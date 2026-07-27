import type { ReactNode } from 'react';

type PersonalSettingsPanelProps = {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
};

export function PersonalSettingsPanel({
  title,
  description,
  children,
}: PersonalSettingsPanelProps) {
  return (
    <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-6 shadow-[0_1px_2px_rgba(42,23,32,0.04),0_3px_10px_rgba(42,23,32,0.05)]">
      {title ? (
        <div className={description ? 'mb-6' : 'mb-4'}>
          <h2 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
