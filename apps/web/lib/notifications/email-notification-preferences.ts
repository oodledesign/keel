export const EMAIL_NOTIFICATION_KEYS = ['commercial_match_digest'] as const;

export type EmailNotificationKey = (typeof EMAIL_NOTIFICATION_KEYS)[number];

export const EMAIL_NOTIFICATION_DEFAULTS: Record<
  EmailNotificationKey,
  boolean
> = {
  commercial_match_digest: true,
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
