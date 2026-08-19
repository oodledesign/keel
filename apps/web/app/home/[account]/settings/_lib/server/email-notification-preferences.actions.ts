'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

import { SaveEmailNotificationPreferencesSchema } from '../schema/email-notification-preferences.schema';

export const saveEmailNotificationPreferences = enhanceAction(
  async (input, user) => {
    const client = getSupabaseServerClient();
    const { error } = await client.from('user_settings').upsert(
      {
        user_id: user.id,
        email_notification_preferences: input.preferences,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: 'user_id' },
    );

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(pathsConfig.app.personalAccountNotificationsSettings);
    revalidatePath(pathsConfig.app.accountNotificationsSettings);

    return { ok: true as const };
  },
  {
    schema: SaveEmailNotificationPreferencesSchema,
  },
);
