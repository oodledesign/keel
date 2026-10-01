'use client';

import { useState, useTransition } from 'react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import { saveDroneDefaultFeeAction } from '~/home/[account]/surveys/_lib/server/survey-report-details-actions';
import {
  inputFromPence,
  penceFromInput,
} from '~/lib/building-surveyor/survey-drone';
import { workspacePanelCard, workspaceTextMuted } from '~/lib/workspace-ui';

export function DroneFeeSettings({
  accountId,
  accountSlug,
  initialFeePence,
}: {
  accountId: string;
  accountSlug: string;
  initialFeePence: number;
}) {
  const [saved, setSaved] = useState(initialFeePence);
  const [value, setValue] = useState(inputFromPence(initialFeePence));
  const [pending, startTransition] = useTransition();

  const feePence = penceFromInput(value);
  const canSave = !pending && feePence !== null && feePence !== saved;

  const save = () => {
    if (feePence === null) return;
    startTransition(async () => {
      try {
        const next = await saveDroneDefaultFeeAction({
          accountId,
          accountSlug,
          feePence,
        });
        setSaved(next);
        setValue(inputFromPence(next));
        toast.success('Default drone fee saved');
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    });
  };

  return (
    <div
      className={`${workspacePanelCard} space-y-3 p-4 sm:p-5`}
      data-test="drone-fee-settings"
    >
      <div>
        <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Drone fee
        </h3>
        <p className={`mt-1 text-xs ${workspaceTextMuted}`}>
          The fee shown as a line on quotes when a drone is charged separately.
          You can change it on an individual survey or quote.
        </p>
      </div>
      <div className="flex items-end gap-3">
        <div className="w-40 space-y-1.5">
          <Label
            htmlFor="drone-default-fee"
            className={`text-xs ${workspaceTextMuted}`}
          >
            Default fee (£)
          </Label>
          <Input
            id="drone-default-fee"
            inputMode="decimal"
            value={value}
            disabled={pending}
            aria-invalid={feePence === null}
            onChange={(event) => setValue(event.target.value)}
            data-test="drone-default-fee"
          />
        </div>
        <Button
          type="button"
          size="sm"
          className="h-9"
          disabled={!canSave}
          onClick={save}
          data-test="drone-default-fee-save"
        >
          Save
        </Button>
      </div>
    </div>
  );
}
