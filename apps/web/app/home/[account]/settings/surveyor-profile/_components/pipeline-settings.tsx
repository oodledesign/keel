'use client';

import { useState, useTransition } from 'react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import { saveSurveyorPipelineSettingsAction } from '~/home/[account]/surveys/_lib/server/survey-report-details-actions';
import type { SurveyorPipelineSettings } from '~/lib/building-surveyor/surveyor-lead';
import { workspacePanelCard, workspaceTextMuted } from '~/lib/workspace-ui';

type DaysKey = Exclude<
  keyof SurveyorPipelineSettings,
  'quoteReminderClientEmail'
>;

const DAY_FIELDS: { key: DaysKey; label: string; hint: string }[] = [
  {
    key: 'leadAmberDays',
    label: 'Amber after',
    hint: 'Days without activity before a lead turns amber.',
  },
  {
    key: 'leadRedDays',
    label: 'Red after',
    hint: 'Days without activity before a lead turns red.',
  },
  {
    key: 'leadArchiveDays',
    label: 'Offer to archive after',
    hint: 'Idle leads are offered for archiving as lost.',
  },
  {
    key: 'quoteReminderDays',
    label: 'Quote reminder after',
    hint: 'Days in Quote sent before you get a reminder.',
  },
];

function parseDays(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const days = Number(value);
  return days >= 1 && days <= 365 ? days : null;
}

export function PipelineSettings({
  accountId,
  accountSlug,
  initialSettings,
}: {
  accountId: string;
  accountSlug: string;
  initialSettings: SurveyorPipelineSettings;
}) {
  const [saved, setSaved] = useState(initialSettings);
  const [days, setDays] = useState<Record<DaysKey, string>>(() => ({
    leadAmberDays: String(initialSettings.leadAmberDays),
    leadRedDays: String(initialSettings.leadRedDays),
    leadArchiveDays: String(initialSettings.leadArchiveDays),
    quoteReminderDays: String(initialSettings.quoteReminderDays),
  }));
  const [clientEmail, setClientEmail] = useState(
    initialSettings.quoteReminderClientEmail,
  );
  const [pending, startTransition] = useTransition();

  const parsed = {
    leadAmberDays: parseDays(days.leadAmberDays),
    leadRedDays: parseDays(days.leadRedDays),
    leadArchiveDays: parseDays(days.leadArchiveDays),
    quoteReminderDays: parseDays(days.quoteReminderDays),
  };
  const redBelowAmber =
    parsed.leadAmberDays !== null &&
    parsed.leadRedDays !== null &&
    parsed.leadRedDays < parsed.leadAmberDays;
  const valid =
    Object.values(parsed).every((value) => value !== null) && !redBelowAmber;
  const dirty =
    clientEmail !== saved.quoteReminderClientEmail ||
    DAY_FIELDS.some(({ key }) => parsed[key] !== saved[key]);

  const save = () => {
    const { leadAmberDays, leadRedDays, leadArchiveDays, quoteReminderDays } =
      parsed;
    if (
      !valid ||
      leadAmberDays === null ||
      leadRedDays === null ||
      leadArchiveDays === null ||
      quoteReminderDays === null
    ) {
      return;
    }
    startTransition(async () => {
      try {
        const next = await saveSurveyorPipelineSettingsAction({
          accountId,
          accountSlug,
          leadAmberDays,
          leadRedDays,
          leadArchiveDays,
          quoteReminderDays,
          quoteReminderClientEmail: clientEmail,
        });
        setSaved(next);
        toast.success('Pipeline settings saved');
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    });
  };

  return (
    <div
      className={`${workspacePanelCard} space-y-4 p-4 sm:p-5`}
      data-test="surveyor-pipeline-settings"
    >
      <div>
        <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Pipeline
        </h3>
        <p className={`mt-1 text-xs ${workspaceTextMuted}`}>
          How quickly leads change colour, when idle leads are offered for
          archiving, and when quote reminders go out.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {DAY_FIELDS.map(({ key, label, hint }) => (
          <div key={key} className="space-y-1.5">
            <Label
              htmlFor={`pipeline-${key}`}
              className={`text-xs ${workspaceTextMuted}`}
            >
              {label} (days)
            </Label>
            <Input
              id={`pipeline-${key}`}
              inputMode="numeric"
              className="w-28"
              value={days[key]}
              disabled={pending}
              aria-invalid={
                parsed[key] === null || (key === 'leadRedDays' && redBelowAmber)
              }
              onChange={(event) =>
                setDays((current) => ({
                  ...current,
                  [key]: event.target.value,
                }))
              }
              data-test={`pipeline-${key}`}
            />
            <p className={`text-xs ${workspaceTextMuted}`}>{hint}</p>
          </div>
        ))}
      </div>
      {redBelowAmber ? (
        <p className="text-xs text-rose-500" role="alert">
          Red must be at least as many days as amber.
        </p>
      ) : null}
      <label className="flex items-start gap-3">
        <Switch
          checked={clientEmail}
          disabled={pending}
          onCheckedChange={setClientEmail}
          data-test="pipeline-client-reminder"
        />
        <span>
          <span className="block text-sm text-[var(--workspace-shell-text)]">
            Also email the client
          </span>
          <span className={`block text-xs ${workspaceTextMuted}`}>
            Sends the client a short reminder with a link to their quote.
          </span>
        </span>
      </label>
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          className="h-9"
          disabled={pending || !valid || !dirty}
          onClick={save}
          data-test="pipeline-settings-save"
        >
          Save
        </Button>
      </div>
    </div>
  );
}
