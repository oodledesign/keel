'use client';

import { useState, useTransition } from 'react';

import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import {
  type SurveyDrone,
  inputFromPence,
  penceFromInput,
} from '~/lib/building-surveyor/survey-drone';
import { workspacePanelCard, workspaceTextMuted } from '~/lib/workspace-ui';

import { updateSurveyDroneAction } from '../_lib/server/survey-report-details-actions';
import { type DroneFormValue, DroneOptionFields } from './drone-option-fields';

function toForm(drone: SurveyDrone): DroneFormValue {
  return {
    used: drone.used,
    billing: drone.billing,
    fee: drone.feePence === null ? '' : inputFromPence(drone.feePence),
  };
}

export function SurveyDroneCard({
  accountId,
  accountSlug,
  proposalId,
  canEdit,
  drone,
}: {
  accountId: string;
  accountSlug: string;
  proposalId: string;
  canEdit: boolean;
  drone: SurveyDrone;
}) {
  const [saved, setSaved] = useState(drone);
  const [value, setValue] = useState(() => toForm(drone));
  const [pending, startTransition] = useTransition();

  const commit = (next: DroneFormValue) => {
    const separate = next.billing === 'separate';
    const feePence =
      separate && next.fee.trim() ? penceFromInput(next.fee) : null;
    if (separate && next.fee.trim() && feePence === null) {
      toast.error('Enter the drone fee as an amount, for example 150');
      setValue(toForm(saved));
      return;
    }
    if (
      next.used === saved.used &&
      next.billing === saved.billing &&
      feePence === saved.feePence
    ) {
      return;
    }
    startTransition(async () => {
      try {
        const result = await updateSurveyDroneAction({
          accountId,
          accountSlug,
          proposalId,
          used: next.used,
          billing: next.billing,
          feePence,
        });
        setSaved(result);
        setValue(toForm(result));
        toast.success('Drone details saved');
      } catch (error) {
        setValue(toForm(saved));
        toast.error(getErrorMessage(error));
      }
    });
  };

  return (
    <div
      className={`${workspacePanelCard} space-y-3 p-4 sm:p-5`}
      data-test="survey-drone-card"
    >
      <div>
        <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Drone
        </h3>
        <p className={`mt-1 text-xs ${workspaceTextMuted}`}>
          Recorded in section A of the report. On a quote it shows as a line
          item, for example Drone £150. Choose Included when a drone is part of
          the standard survey fee.
        </p>
      </div>
      <DroneOptionFields
        accountId={accountId}
        idPrefix="survey-drone"
        value={value}
        onChange={setValue}
        onCommit={commit}
        disabled={!canEdit || pending}
      />
    </div>
  );
}
