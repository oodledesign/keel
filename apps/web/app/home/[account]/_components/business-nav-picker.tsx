'use client';

import { Switch } from '@kit/ui/switch';

import { BUSINESS_NAV_CHOICE_SECTIONS } from '../_lib/business-nav-preferences';

const rowClass = 'flex items-center justify-between gap-3 px-4 py-3';
const labelClass = 'text-sm font-medium text-[var(--workspace-shell-text)]';
const hintClass = 'text-xs text-[var(--workspace-shell-text-muted)]';

export function BusinessNavPicker({
  values,
  onChange,
  disabled = false,
  paidOnlyKeys = [],
}: {
  values: Record<string, boolean>;
  onChange: (key: string, visible: boolean) => void;
  disabled?: boolean;
  /** Links the workspace's plan doesn't include yet; shown once upgraded. */
  paidOnlyKeys?: readonly string[];
}) {
  return (
    <div className="flex flex-col gap-4" data-test="business-nav-picker">
      <ul className="rounded-xl border border-[color:var(--workspace-shell-border)]">
        <li className={rowClass}>
          <div>
            <p className={labelClass}>Dashboard</p>
            <p className={hintClass}>Always shown</p>
          </div>
          <Switch checked disabled aria-label="Dashboard is always shown" />
        </li>
      </ul>

      {BUSINESS_NAV_CHOICE_SECTIONS.map((section) => (
        <div key={section.label} className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
            {section.label}
          </p>
          <ul className="divide-y divide-[color:var(--workspace-shell-border)] rounded-xl border border-[color:var(--workspace-shell-border)]">
            {section.choices.map((choice) => (
              <li key={choice.key} className={rowClass}>
                <div>
                  <p className={labelClass}>{choice.label}</p>
                  {paidOnlyKeys.includes(choice.key) ? (
                    <p className={hintClass}>Not on the Free plan</p>
                  ) : null}
                </div>
                <Switch
                  checked={values[choice.key] ?? true}
                  disabled={disabled}
                  onCheckedChange={(checked) => onChange(choice.key, checked)}
                  aria-label={`Show ${choice.label}`}
                  data-test={`business-nav-toggle-${choice.key}`}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
