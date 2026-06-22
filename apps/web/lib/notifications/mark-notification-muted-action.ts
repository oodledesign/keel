'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  markNotificationMutedForUser,
  type NotificationSurfaceInput,
} from '~/lib/notifications/surface-notification';

export async function markNotificationMutedAction(
  notification: NotificationSurfaceInput,
) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false as const };
  }

  await markNotificationMutedForUser(client, notification, user.id);
  return { success: true as const };
}
