'use client';

import { useState, useTransition } from 'react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Switch } from '@kit/ui/switch';
import { toast } from '@kit/ui/sonner';

import {
  workspaceBtnPrimaryMd,
  workspacePanelBorder,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { upsertNotificationSettingsAction } from '../_lib/server/scheduling-actions';
import type { NotificationSettingsRow } from '../_lib/server/scheduling.service';

const PRESET_OFFSETS = [
  { label: '24 hours', minutes: 1440 },
  { label: '2 hours', minutes: 120 },
  { label: '1 hour', minutes: 60 },
  { label: '15 minutes', minutes: 15 },
];

type Props = {
  accountId: string;
  accountSlug: string;
  canEdit: boolean;
  settings: NotificationSettingsRow;
};

export function NotificationsForm({
  accountId,
  accountSlug,
  canEdit,
  settings: initial,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [settings, setSettings] = useState(initial);
  const [customMinutes, setCustomMinutes] = useState('');

  function toggleOffset(minutes: number) {
    setSettings((current) => {
      const exists = current.reminderOffsetsMinutes.includes(minutes);
      return {
        ...current,
        reminderOffsetsMinutes: exists
          ? current.reminderOffsetsMinutes.filter((value) => value !== minutes)
          : [...current.reminderOffsetsMinutes, minutes].sort((a, b) => b - a),
      };
    });
  }

  function addCustom() {
    const minutes = Number(customMinutes);
    if (!minutes || minutes < 1) return;
    toggleOffset(minutes);
    setCustomMinutes('');
  }

  function save() {
    startTransition(async () => {
      try {
        const saved = await upsertNotificationSettingsAction({
          accountId,
          accountSlug,
          sendConfirmationToInvitee: settings.sendConfirmationToInvitee,
          sendConfirmationToHost: settings.sendConfirmationToHost,
          reminderOffsetsMinutes: settings.reminderOffsetsMinutes,
          sendCancellationEmails: settings.sendCancellationEmails,
          replyToEmail: settings.replyToEmail,
        });
        setSettings(saved);
        toast.success('Notification settings saved');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save settings',
        );
      }
    });
  }

  return (
    <div className={`max-w-2xl space-y-6 rounded-2xl border p-5 ${workspacePanelBorder}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Notifications</h2>
          <p className={`text-sm ${workspaceTextMuted}`}>
            Confirmations, reminders, and cancellation emails for this workspace.
          </p>
        </div>
        {canEdit ? (
          <Button
            type="button"
            className={workspaceBtnPrimaryMd}
            disabled={pending}
            onClick={save}
          >
            Save
          </Button>
        ) : null}
      </div>

      <ToggleRow
        label="Send confirmation to invitee"
        checked={settings.sendConfirmationToInvitee}
        disabled={!canEdit}
        onChange={(sendConfirmationToInvitee) =>
          setSettings((current) => ({ ...current, sendConfirmationToInvitee }))
        }
      />
      <ToggleRow
        label="Send confirmation to host"
        checked={settings.sendConfirmationToHost}
        disabled={!canEdit}
        onChange={(sendConfirmationToHost) =>
          setSettings((current) => ({ ...current, sendConfirmationToHost }))
        }
      />
      <ToggleRow
        label="Send cancellation emails"
        checked={settings.sendCancellationEmails}
        disabled={!canEdit}
        onChange={(sendCancellationEmails) =>
          setSettings((current) => ({ ...current, sendCancellationEmails }))
        }
      />

      <div className="space-y-3">
        <Label>Reminder offsets</Label>
        <div className="flex flex-wrap gap-2">
          {PRESET_OFFSETS.map((preset) => {
            const active = settings.reminderOffsetsMinutes.includes(
              preset.minutes,
            );
            return (
              <button
                key={preset.minutes}
                type="button"
                disabled={!canEdit}
                onClick={() => toggleOffset(preset.minutes)}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  active
                    ? 'border-[var(--ozer-accent)]/40 bg-[var(--ozer-accent-subtle)]'
                    : 'border-[color:var(--workspace-shell-border)]'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
          {settings.reminderOffsetsMinutes
            .filter(
              (minutes) =>
                !PRESET_OFFSETS.some((preset) => preset.minutes === minutes),
            )
            .map((minutes) => (
              <button
                key={minutes}
                type="button"
                disabled={!canEdit}
                onClick={() => toggleOffset(minutes)}
                className="rounded-full border border-[var(--ozer-accent)]/40 bg-[var(--ozer-accent-subtle)] px-3 py-1.5 text-sm"
              >
                {minutes} min
              </button>
            ))}
        </div>
        {canEdit ? (
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Custom minutes"
              value={customMinutes}
              onChange={(e) => setCustomMinutes(e.target.value)}
            />
            <Button type="button" variant="outline" onClick={addCustom}>
              Add
            </Button>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="reply-to">Reply-to email</Label>
        <Input
          id="reply-to"
          type="email"
          disabled={!canEdit}
          placeholder="bookings@youragency.co.uk"
          value={settings.replyToEmail ?? ''}
          onChange={(e) =>
            setSettings((current) => ({
              ...current,
              replyToEmail: e.target.value || null,
            }))
          }
        />
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] px-4 py-3">
      <Label>{label}</Label>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}
