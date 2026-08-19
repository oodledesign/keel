import { z } from 'zod';

import { EMAIL_NOTIFICATION_KEYS } from '~/lib/notifications/email-notification-preferences';

export const SaveEmailNotificationPreferencesSchema = z.object({
  preferences: z.object(
    Object.fromEntries(
      EMAIL_NOTIFICATION_KEYS.map((key) => [key, z.boolean()]),
    ) as Record<(typeof EMAIL_NOTIFICATION_KEYS)[number], z.ZodBoolean>,
  ),
});

export type SaveEmailNotificationPreferencesInput = z.infer<
  typeof SaveEmailNotificationPreferencesSchema
>;
