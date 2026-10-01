'use client';

import { useState } from 'react';

import { Checkbox } from '@kit/ui/checkbox';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import {
  DRONE_BILLING_OPTIONS,
  type DroneBilling,
  inputFromPence,
} from '~/lib/building-surveyor/survey-drone';
import { workspaceTextMuted } from '~/lib/workspace-ui';

import { getDroneDefaultFeeAction } from '../_lib/server/survey-report-details-actions';

export type DroneFormValue = {
  used: boolean;
  billing: DroneBilling;
  /** Typed fee. Empty means the workspace default applies. */
  fee: string;
};

export const EMPTY_DRONE_FORM: DroneFormValue = {
  used: false,
  billing: 'separate',
  fee: '',
};

const BILLING_LABELS: Record<DroneBilling, string> = {
  separate: 'Charge separately',
  included: 'Included in survey fee',
};

export function DroneOptionFields({
  accountId,
  idPrefix,
  value,
  onChange,
  onCommit,
  disabled = false,
}: {
  accountId: string;
  idPrefix: string;
  value: DroneFormValue;
  onChange: (next: DroneFormValue) => void;
  /** Called when a change should be saved (toggle, billing, or fee blur). */
  onCommit?: (next: DroneFormValue) => void;
  disabled?: boolean;
}) {
  const [defaultFee, setDefaultFee] = useState<string | null>(null);

  const loadDefaultFee = () => {
    if (defaultFee !== null) return;
    void getDroneDefaultFeeAction({ accountId })
      .then((pence) => setDefaultFee(inputFromPence(pence)))
      .catch(() => {
        setDefaultFee('');
        toast.error('Could not load the default drone fee');
      });
  };

  const update = (patch: Partial<DroneFormValue>, commit: boolean) => {
    const next = { ...value, ...patch };
    onChange(next);
    if (commit) onCommit?.(next);
  };

  return (
    <div className="space-y-3">
      <label
        htmlFor={`${idPrefix}-used`}
        className="flex items-center gap-2 text-sm text-[var(--workspace-shell-text)]"
      >
        <Checkbox
          id={`${idPrefix}-used`}
          checked={value.used}
          disabled={disabled}
          onCheckedChange={(checked) => {
            if (checked === true) loadDefaultFee();
            update({ used: checked === true }, true);
          }}
          data-test={`${idPrefix}-used`}
        />
        Drone used
      </label>

      {value.used ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label
              htmlFor={`${idPrefix}-billing`}
              className={`text-xs ${workspaceTextMuted}`}
            >
              Billing
            </Label>
            <select
              id={`${idPrefix}-billing`}
              value={value.billing}
              disabled={disabled}
              onChange={(event) =>
                update({ billing: event.target.value as DroneBilling }, true)
              }
              className="h-9 w-full rounded-md border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] px-2 text-sm text-[var(--workspace-shell-text)]"
              data-test={`${idPrefix}-billing`}
            >
              {DRONE_BILLING_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {BILLING_LABELS[option]}
                </option>
              ))}
            </select>
          </div>
          {value.billing === 'separate' ? (
            <div className="space-y-1.5">
              <Label
                htmlFor={`${idPrefix}-fee`}
                className={`text-xs ${workspaceTextMuted}`}
              >
                Drone fee (£)
              </Label>
              <Input
                id={`${idPrefix}-fee`}
                inputMode="decimal"
                value={value.fee}
                disabled={disabled}
                placeholder={defaultFee ? `${defaultFee} (default)` : 'Default'}
                onFocus={loadDefaultFee}
                onChange={(event) => update({ fee: event.target.value }, false)}
                onBlur={() => onCommit?.(value)}
                data-test={`${idPrefix}-fee`}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
