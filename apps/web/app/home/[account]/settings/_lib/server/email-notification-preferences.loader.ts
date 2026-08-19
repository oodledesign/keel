import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  resolveEmailNotificationPreferences,
  type EmailNotificationKey,
} from '~/lib/notifications/email-notification-preferences';

export async function loadEmailNotificationPreferences(
  userId: string,
): Promise<Record<EmailNotificationKey, boolean>> {
  const client = getSupabaseServerClient();
  const { data } = await client
    .from('user_settings')
    .select('email_notification_preferences')
    .eq('user_id', userId)
    .maybeSingle();

  const row = data as { email_notification_preferences?: unknown } | null;
  return resolveEmailNotificationPreferences(
    row?.email_notification_preferences,
  );
}
