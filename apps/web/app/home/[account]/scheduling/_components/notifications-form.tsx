'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';

import { Palette } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Switch } from '@kit/ui/switch';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
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

export type NotificationBrandPreview = {
  primaryColor: string;
  accentColor: string;
  logoUrl: string | null;
  workspaceName: string;
};

type Props = {
  accountId: string;
  accountSlug: string;
  canEdit: boolean;
  settings: NotificationSettingsRow;
  brand: NotificationBrandPreview;
};

export function NotificationsForm({
  accountId,
  accountSlug,
  canEdit,
  settings: initial,
  brand,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [settings, setSettings] = useState(initial);
  const [customMinutes, setCustomMinutes] = useState('');
  const brandSettingsHref = pathsConfig.app.accountBrandSettings.replace(
    '[account]',
    accountSlug,
  );

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
    <div className="grid gap-6 xl:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
      <div className={`space-y-6 rounded-2xl border p-5 ${workspacePanelBorder}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Notifications</h2>
            <p className={`text-sm ${workspaceTextMuted}`}>
              Confirmations, reminders, and cancellation emails for this
              workspace.
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
            setSettings((current) => ({
              ...current,
              sendConfirmationToInvitee,
            }))
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
            setSettings((current) => ({
              ...current,
              sendCancellationEmails,
            }))
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

      <div className={`space-y-4 rounded-2xl border p-5 ${workspacePanelBorder}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Email previews</h2>
            <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
              Booking emails use your workspace brand colours — the header bar
              shows your primary colour.
            </p>
          </div>
          <Link
            href={brandSettingsHref}
            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--workspace-shell-border)] px-3 py-1.5 text-sm font-medium text-[var(--workspace-shell-text)] transition hover:border-[var(--ozer-accent)]/40 hover:text-[var(--ozer-accent)]"
          >
            <Palette className="h-3.5 w-3.5" />
            Brand colour settings
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 py-2.5 text-sm">
          <span className={`text-xs ${workspaceTextMuted}`}>Primary</span>
          <span
            className="inline-block h-5 w-5 rounded-full border border-black/10"
            style={{ backgroundColor: brand.primaryColor }}
            title={brand.primaryColor}
            aria-label={`Primary colour ${brand.primaryColor}`}
          />
          <code className="text-xs text-[var(--workspace-shell-text)]">
            {brand.primaryColor}
          </code>
          <span className={`ml-2 text-xs ${workspaceTextMuted}`}>Accent</span>
          <span
            className="inline-block h-5 w-5 rounded-full border border-black/10"
            style={{ backgroundColor: brand.accentColor }}
            title={brand.accentColor}
            aria-label={`Accent colour ${brand.accentColor}`}
          />
          <code className="text-xs text-[var(--workspace-shell-text)]">
            {brand.accentColor}
          </code>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <EmailPreviewCard
            brand={brand}
            label="Invitee confirmation"
            subject="Confirmed: Discovery call"
            enabled={settings.sendConfirmationToInvitee}
          >
            <p>Hi Alex,</p>
            <p>
              Your booking with <strong>{brand.workspaceName}</strong> is
              confirmed.
            </p>
            <p>
              <strong>Meeting:</strong> Discovery call
            </p>
            <p>
              <strong>When:</strong> Tue 21 Jul 2026, 10:00–10:30
            </p>
            <p style={{ color: brand.accentColor }}>
              <strong>Join:</strong> meet.google.com/demo
            </p>
            <p className="text-xs opacity-70">Manage your booking</p>
          </EmailPreviewCard>

          <EmailPreviewCard
            brand={brand}
            label="Host confirmation"
            subject="New booking: Discovery call"
            enabled={settings.sendConfirmationToHost}
          >
            <p>
              You have a new booking on <strong>Book a call</strong>.
            </p>
            <p>
              <strong>Invitee:</strong> Alex Example &lt;alex@example.com&gt;
            </p>
            <p>
              <strong>Meeting:</strong> Discovery call
            </p>
            <p>
              <strong>When:</strong> Tue 21 Jul 2026, 10:00–10:30
            </p>
          </EmailPreviewCard>

          <EmailPreviewCard
            brand={brand}
            label="Reminder"
            subject="Reminder: Discovery call"
            enabled={settings.reminderOffsetsMinutes.length > 0}
          >
            <p>Hi Alex,</p>
            <p>
              This is a friendly reminder about your upcoming meeting with{' '}
              <strong>{brand.workspaceName}</strong>.
            </p>
            <p>
              <strong>When:</strong> Tue 21 Jul 2026, 10:00–10:30
            </p>
            <p className="text-xs opacity-70">Manage your booking</p>
          </EmailPreviewCard>

          <EmailPreviewCard
            brand={brand}
            label="Cancellation"
            subject="Cancelled: Discovery call"
            enabled={settings.sendCancellationEmails}
          >
            <p>Hi Alex,</p>
            <p>
              Your booking for <strong>Discovery call</strong> with{' '}
              {brand.workspaceName} has been cancelled.
            </p>
            <p>
              <strong>Was scheduled for:</strong> Tue 21 Jul 2026, 10:00–10:30
            </p>
          </EmailPreviewCard>
        </div>

        <p className={`text-xs ${workspaceTextMuted}`}>
          Booking page accent colours only style the public booking site. These
          notification emails always use{' '}
          <Link
            href={brandSettingsHref}
            className="font-medium text-[var(--ozer-accent)] hover:underline"
          >
            Settings → Brand
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function EmailPreviewCard({
  brand,
  label,
  subject,
  enabled,
  children,
}: {
  brand: NotificationBrandPreview;
  label: string;
  subject: string;
  enabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-white shadow-sm ${
        enabled ? '' : 'opacity-45'
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-black/5 bg-[#f6f4f5] px-3 py-2">
        <p className="text-xs font-medium text-[#3d2a33]">{label}</p>
        {!enabled ? (
          <span className="text-[10px] uppercase tracking-wide text-[#7a6870]">
            Off
          </span>
        ) : null}
      </div>
      <div className="border-b border-black/5 px-3 py-2">
        <p className="truncate text-[11px] text-[#7a6870]">Subject</p>
        <p className="truncate text-sm font-medium text-[#09111F]">{subject}</p>
      </div>
      <div
        className="flex min-h-[52px] items-center px-4 py-3"
        style={{ backgroundColor: brand.primaryColor }}
      >
        {brand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- email/CDN brand logo; match transactional wrap
          <img
            src={brand.logoUrl}
            alt=""
            className="h-8 w-auto max-w-[140px] object-contain object-left"
          />
        ) : null}
      </div>
      <div className="space-y-2 px-4 py-4 text-[13px] leading-relaxed text-[#09111F] [&>p]:m-0">
        {children}
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
