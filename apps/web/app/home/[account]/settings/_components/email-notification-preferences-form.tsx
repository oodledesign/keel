'use client';

import { useState, useTransition } from 'react';

import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import {
  EMAIL_NOTIFICATION_COPY,
  EMAIL_NOTIFICATION_KEYS,
  type EmailNotificationKey,
} from '~/lib/notifications/email-notification-preferences';

import { saveEmailNotificationPreferences } from '../_lib/server/email-notification-preferences.actions';

export function EmailNotificationPreferencesForm({
  initialPreferences,
}: {
  initialPreferences: Record<EmailNotificationKey, boolean>;
}) {
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(initialPreferences);

  function toggle(key: EmailNotificationKey, enabled: boolean) {
    const next = { ...values, [key]: enabled };
    setValues(next);
    startTransition(async () => {
      try {
        await saveEmailNotificationPreferences({ preferences: next });
        toast.success('Notification preferences saved');
      } catch (error) {
        setValues(values);
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not save notification preferences',
        );
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-6 shadow-[0_1px_2px_rgba(42,23,32,0.04),0_3px_10px_rgba(42,23,32,0.05)]">
      <div>
        <h2 className="text-base font-semibold text-[var(--workspace-shell-text)]">
          Email notifications
        </h2>
        <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
          Choose which Ozer emails you receive. In-app alerts in the bell are
          unchanged.
        </p>
      </div>

      <ul className="divide-y divide-[color:var(--workspace-shell-border)] rounded-xl border border-[color:var(--workspace-shell-border)]">
        {EMAIL_NOTIFICATION_KEYS.map((key) => {
          const copy = EMAIL_NOTIFICATION_COPY[key];
          return (
            <li
              key={key}
              className="flex items-start justify-between gap-4 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                  {copy.title}
                </p>
                <p className="mt-0.5 text-sm text-[var(--workspace-shell-text-muted)]">
                  {copy.description}
                </p>
              </div>
              <Switch
                checked={values[key]}
                disabled={pending}
                onCheckedChange={(enabled) => toggle(key, enabled)}
                aria-label={copy.title}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
