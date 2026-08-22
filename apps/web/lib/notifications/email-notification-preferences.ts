export const EMAIL_NOTIFICATION_KEYS = [
  'commercial_match_digest',
  'email_stuck_thread_digest',
  'email_follow_up_reminders',
] as const;

export type EmailNotificationKey = (typeof EMAIL_NOTIFICATION_KEYS)[number];

export const EMAIL_NOTIFICATION_DEFAULTS: Record<
  EmailNotificationKey,
  boolean
> = {
  commercial_match_digest: true,
  email_stuck_thread_digest: true,
  email_follow_up_reminders: true,
};

export const EMAIL_NOTIFICATION_COPY: Record<
  EmailNotificationKey,
  { title: string; description: string }
> = {
  commercial_match_digest: {
    title: 'Match suggestion emails',
    description:
      'A digest when this workspace has new disposal ↔ requirement matches. Owners and admins receive these by default.',
  },
  email_stuck_thread_digest: {
    title: 'Stuck email thread digest',
    description:
      'Weekly summary of actionable email threads that have been waiting several days without a reply.',
  },
  email_follow_up_reminders: {
    title: 'Email follow-up reminders',
    description:
      'Daily reminders when a thread you snoozed is due for follow-up.',
  },
};

export function isEmailNotificationEnabled(
  prefs: unknown,
  key: EmailNotificationKey,
): boolean {
  const fallback = EMAIL_NOTIFICATION_DEFAULTS[key];
  if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) {
    return fallback;
  }
  const value = (prefs as Record<string, unknown>)[key];
  return typeof value === 'boolean' ? value : fallback;
}

export function resolveEmailNotificationPreferences(
  prefs: unknown,
): Record<EmailNotificationKey, boolean> {
  return Object.fromEntries(
    EMAIL_NOTIFICATION_KEYS.map((key) => [
      key,
      isEmailNotificationEnabled(prefs, key),
    ]),
  ) as Record<EmailNotificationKey, boolean>;
}
