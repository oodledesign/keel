import 'server-only';

import {
  loadPersonalAccountPicture,
  removePersonalProfileImage,
  storePersonalProfileImage,
} from '~/lib/account/profile-image';
import { resolveEmailNotificationPreferences } from '~/lib/notifications/email-notification-preferences';
import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

import type { NativeAuthContext } from './auth';
import { NativeHttpError } from './http';
import {
  type NativePersonalSettingsPatch,
  joinDisplayName,
  readNativeImageFile,
  splitDisplayName,
  toNativeEmailNotifications,
} from './settings-shared';

type Requester = Pick<NativeAuthContext, 'userId' | 'email' | 'supabase'>;

export async function loadNativePersonalSettings(requester: Requester) {
  const { supabase, userId } = requester;

  const [account, { data: settings, error: settingsError }] = await Promise.all(
    [
      supabase
        .from('accounts')
        .select('id, name, email, picture_url')
        .eq('primary_owner_user_id', userId)
        .eq('is_personal_account', true)
        .maybeSingle(),
      supabase
        .from('user_settings')
        .select('first_name, last_name, email_notification_preferences')
        .eq('user_id', userId)
        .maybeSingle(),
    ],
  );

  if (account.error) throw account.error;
  if (settingsError) throw settingsError;
  if (!account.data) {
    throw new NativeHttpError(404, 'Personal account not found');
  }

  const row = account.data as {
    name: string | null;
    email: string | null;
    picture_url: string | null;
  };
  const stored = settings as {
    first_name?: string | null;
    last_name?: string | null;
    email_notification_preferences?: unknown;
  } | null;
  const storedFirst = stored?.first_name?.trim() ?? '';
  const storedLast = stored?.last_name?.trim() ?? '';
  const fallback = splitDisplayName(row.name);
  const hasStoredName = Boolean(storedFirst || storedLast);
  const firstName = hasStoredName ? storedFirst : fallback.firstName;
  const lastName = hasStoredName ? storedLast : fallback.lastName;

  return {
    first_name: firstName,
    last_name: lastName,
    display_name: joinDisplayName(firstName, lastName) || row.name || '',
    email: requester.email ?? row.email,
    picture_url: toSupabasePublicStorageUrl(row.picture_url),
    email_notifications: toNativeEmailNotifications(
      resolveEmailNotificationPreferences(
        stored?.email_notification_preferences,
      ),
    ),
  };
}

export async function updateNativePersonalSettings(
  requester: Requester,
  patch: NativePersonalSettingsPatch,
) {
  const { supabase, userId } = requester;
  const now = new Date().toISOString();

  if (patch.first_name !== undefined || patch.last_name !== undefined) {
    const current = await loadNativePersonalSettings(requester);
    const firstName = patch.first_name ?? current.first_name;
    const lastName = patch.last_name ?? current.last_name;

    const { error: settingsError } = await supabase
      .from('user_settings')
      .upsert(
        {
          user_id: userId,
          first_name: firstName || null,
          last_name: lastName || null,
          updated_at: now,
        },
        { onConflict: 'user_id' },
      );
    if (settingsError) throw settingsError;

    const displayName = joinDisplayName(firstName, lastName);
    if (displayName) {
      const { error: accountError } = await supabase
        .from('accounts')
        .update({ name: displayName, updated_at: now })
        .eq('primary_owner_user_id', userId)
        .eq('is_personal_account', true);
      if (accountError) throw accountError;
    }
  }

  if (patch.email_notifications) {
    const { data: existing } = await supabase
      .from('user_settings')
      .select('email_notification_preferences')
      .eq('user_id', userId)
      .maybeSingle();

    const merged = {
      ...resolveEmailNotificationPreferences(
        (existing as { email_notification_preferences?: unknown } | null)
          ?.email_notification_preferences,
      ),
      ...patch.email_notifications,
    };

    const { error } = await supabase.from('user_settings').upsert(
      {
        user_id: userId,
        email_notification_preferences: merged,
        updated_at: now,
      },
      { onConflict: 'user_id' },
    );
    if (error) throw error;
  }

  return loadNativePersonalSettings(requester);
}

async function requirePersonalAccount(requester: Requester) {
  const account = await loadPersonalAccountPicture(
    requester.supabase,
    requester.userId,
  );
  if (!account) {
    throw new NativeHttpError(404, 'Personal account not found');
  }
  return account;
}

export async function uploadNativeProfilePhoto(
  requester: Requester,
  file: Blob | null,
) {
  const image = readNativeImageFile(file);
  const account = await requirePersonalAccount(requester);

  const pictureUrl = await storePersonalProfileImage({
    client: requester.supabase,
    account,
    bytes: Buffer.from(await image.file.arrayBuffer()),
    contentType: image.contentType,
  });

  return { picture_url: pictureUrl };
}

export async function removeNativeProfilePhoto(requester: Requester) {
  const account = await requirePersonalAccount(requester);
  await removePersonalProfileImage({ client: requester.supabase, account });
  return { picture_url: null };
}
