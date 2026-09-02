import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  type NativeDevicePlatform,
  parseNativeDevicePlatform,
  parseNativeDeviceToken,
} from './devices-shared';
import type { NativeWorkspace } from './workspace-shared';

export type { NativeDevicePlatform } from './devices-shared';
export {
  parseNativeDevicePlatform,
  parseNativeDeviceToken,
} from './devices-shared';

export type NativeDevice = {
  token: string;
  platform: NativeDevicePlatform;
  workspace: string | null;
};

export async function upsertNativeDevice(input: {
  client: SupabaseClient;
  userId: string;
  token: string;
  platform?: string | null;
  workspace?: NativeWorkspace | null;
}): Promise<NativeDevice> {
  const token = parseNativeDeviceToken(input.token);
  const platform = parseNativeDevicePlatform(input.platform);

  const { error, count } = await input.client
    .from('native_device_tokens' as never)
    .upsert(
      {
        user_id: input.userId,
        token,
        platform,
        account_id: input.workspace?.id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token', count: 'exact' },
    );

  if (error) {
    throw new Error(error.message);
  }

  if ((count ?? 0) === 0) {
    console.warn('[native/devices] token upsert matched no rows', {
      userId: input.userId,
    });
  }

  return {
    token,
    platform,
    workspace: input.workspace
      ? input.workspace.slug || input.workspace.id
      : null,
  };
}
