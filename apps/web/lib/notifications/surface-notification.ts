import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  computeWorkspaceFocusState,
  type WorkspaceFocusInput,
} from '~/lib/workspace-focus';
import { loadWorkspaceFocusSettingsForAccount } from '~/lib/workspace-focus/load-workspace-focus-settings';

export type NotificationSurfaceInput = {
  id: number;
  account_id: string;
};

export function shouldSurfaceNotificationForFocus(
  notification: NotificationSurfaceInput,
  userId: string,
  focusSettings: WorkspaceFocusInput | null,
  now = new Date(),
): boolean {
  if (!focusSettings) {
    return true;
  }

  if (notification.account_id === userId) {
    return true;
  }

  const state = computeWorkspaceFocusState(focusSettings, now);
  return !state.isWorkspaceSilenced;
}

export async function shouldSurfaceNotification(
  client: SupabaseClient,
  notification: NotificationSurfaceInput,
  userId: string,
  now = new Date(),
): Promise<boolean> {
  const { data: existingMute } = await client
    .from('notification_user_mutes')
    .select('notification_id')
    .eq('user_id', userId)
    .eq('notification_id', notification.id)
    .maybeSingle();

  if (existingMute) {
    return false;
  }

  const focusSettings = await loadWorkspaceFocusSettingsForAccount(
    client,
    userId,
    notification.account_id,
  );

  return shouldSurfaceNotificationForFocus(
    notification,
    userId,
    focusSettings,
    now,
  );
}

export async function markNotificationMutedForUser(
  client: SupabaseClient,
  notification: NotificationSurfaceInput,
  userId: string,
): Promise<void> {
  await client.from('notification_user_mutes').upsert(
    {
      user_id: userId,
      notification_id: notification.id,
    },
    { onConflict: 'user_id,notification_id' },
  );

  if (notification.account_id === userId) {
    await client
      .from('notifications')
      .update({ muted: true })
      .eq('id', notification.id);
  }
}
