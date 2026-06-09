'use server';

import { revalidatePath } from 'next/cache';

import type { SupabaseClient } from '@supabase/supabase-js';
import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { z } from 'zod';

import pathsConfig from '~/config/paths.config';
import {
  canEncryptVideoSecrets,
  encryptVideoSecret,
} from '~/lib/videos/crypto-secrets';
import {
  loadAccountPresets,
  loadAccountVideoSettings,
  updateAccountVideoSettings,
} from '~/lib/videos/server/player-config-data';

const saveVideoSettingsSchema = z.object({
  accountId: z.string().uuid(),
  bunny_library_id: z.string().max(120).nullable().optional(),
  bunny_api_key: z.string().max(500).nullable().optional(),
  default_player_preset_id: z.string().uuid().nullable().optional(),
  clear_bunny_api_key: z.boolean().optional(),
});

function workPath(template: string, accountSlug: string) {
  return template.replace('[account]', accountSlug);
}

async function assertAccountOwnerOrAdmin(accountId: string, userId: string) {
  const client = getSupabaseServerClient() as SupabaseClient;
  const { data: membership } = await client
    .from('accounts_memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  const role = membership?.account_role;
  if (role !== 'owner' && role !== 'admin') {
    throw new Error('Workspace owner or admin required');
  }

  const { data: account } = await client
    .from('accounts')
    .select('slug')
    .eq('id', accountId)
    .maybeSingle();

  if (!account?.slug) {
    throw new Error('Account not found');
  }

  return { accountSlug: account.slug as string, client };
}

export const saveVideoModuleSettings = enhanceAction(
  async (input, user) => {
    const { accountSlug, client } = await assertAccountOwnerOrAdmin(
      input.accountId,
      user.id,
    );

    if (input.default_player_preset_id) {
      const presets = await loadAccountPresets(client, input.accountId);
      const exists = presets.some(
        (preset) => preset.id === input.default_player_preset_id,
      );
      if (!exists) {
        throw new Error('Default preset not found in this workspace');
      }
    }

    const current = await loadAccountVideoSettings(client, input.accountId);
    const patch: Record<string, string | null | undefined> = {
      bunny_library_id:
        input.bunny_library_id === undefined
          ? current.bunny_library_id
          : input.bunny_library_id?.trim() || null,
      default_player_preset_id:
        input.default_player_preset_id === undefined
          ? current.default_player_preset_id
          : input.default_player_preset_id,
    };

    if (input.clear_bunny_api_key) {
      patch.bunny_api_key_encrypted = null;
    } else if (input.bunny_api_key?.trim()) {
      if (!canEncryptVideoSecrets()) {
        throw new Error(
          'TOKEN_ENCRYPTION_KEY is required to store Bunny API keys securely',
        );
      }
      patch.bunny_api_key_encrypted = encryptVideoSecret(
        input.bunny_api_key.trim(),
      );
    } else {
      patch.bunny_api_key_encrypted = current.bunny_api_key_encrypted;
    }

    await updateAccountVideoSettings(client, input.accountId, patch);

    revalidatePath(workPath(pathsConfig.app.accountVideoSettings, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountVideos, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountVideoPresets, accountSlug));

    return { ok: true as const };
  },
  { schema: saveVideoSettingsSchema },
);
