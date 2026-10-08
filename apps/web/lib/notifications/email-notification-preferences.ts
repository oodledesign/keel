export const EMAIL_NOTIFICATION_KEYS = [
  'commercial_match_digest',
  'email_stuck_thread_digest',
  'email_follow_up_reminders',
  'project_retainer_digest',
] as const;

export type EmailNotificationKey = (typeof EMAIL_NOTIFICATION_KEYS)[number];

export const EMAIL_NOTIFICATION_DEFAULTS: Record<
  EmailNotificationKey,
  boolean
> = {
  commercial_match_digest: true,
  email_stuck_thread_digest: true,
  email_follow_up_reminders: true,
  project_retainer_digest: true,
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
  project_retainer_digest: {
    title: 'Project retainer digest',
    description:
      'Weekly summary of project credit burns and balance changes. Only sent when a project has the digest switch on and activity that week.',
  },
};

/** Toggles that apply to a workspace; others are kept but not shown. */
export function visibleEmailNotificationKeys(input: {
  workspaceProfile: string;
  businessLite: boolean;
  emailAssistantAvailable: boolean;
}): EmailNotificationKey[] {
  const visible: Record<EmailNotificationKey, boolean> = {
    commercial_match_digest: input.workspaceProfile === 'commercial_property',
    email_stuck_thread_digest: input.emailAssistantAvailable,
    email_follow_up_reminders: input.emailAssistantAvailable,
    project_retainer_digest:
      input.workspaceProfile === 'work_design' && !input.businessLite,
  };

  return EMAIL_NOTIFICATION_KEYS.filter((key) => visible[key]);
}

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
