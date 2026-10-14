'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import pathsConfig from '~/config/paths.config';
import { assertInstagramAutoreplyAccess } from '~/lib/instagram-autoreply/assert-access';
import {
  type IgMenuItem,
  setIceBreakers,
  setPersistentMenu,
} from '~/lib/instagram-autoreply/graph-api';
import { igMessengerProfileSchema } from '~/lib/instagram-autoreply/messenger-profile';
import { buildEntryPayload } from '~/lib/instagram-autoreply/sequence/payload';
import { decryptIgToken } from '~/lib/instagram-autoreply/token-crypto';

const saveMessengerProfileSchema = z.object({
  accountId: z.string().uuid(),
  profile: igMessengerProfileSchema,
});

/**
 * Push Ice Breakers and the persistent menu to Meta, then store what was sent.
 * Each entry points at an automation whose trigger type is ice_breaker or
 * menu_payload; taps arrive as `igentry:{triggerId}` postbacks.
 */
export const saveIgMessengerProfile = enhanceAction(
  async (input, user) => {
    const { client, slug } = await assertInstagramAutoreplyAccess(
      input.accountId,
      user.id,
    );

    const { data: canManage } = await client.rpc('has_permission', {
      user_id: user.id,
      account_id: input.accountId,
      permission_name: 'settings.manage',
    });
    if (!canManage) throw new Error('You need permission to manage settings');

    const { profile } = input;
    const triggerIds = [
      ...profile.ice_breakers.map((b) => b.trigger_id),
      ...profile.persistent_menu.flatMap((m) =>
        m.type === 'postback' ? [m.trigger_id] : [],
      ),
    ];

    if (triggerIds.length > 0) {
      const { data: triggers, error } = await client
        .from('ig_triggers')
        .select('id, trigger_type')
        .eq('account_id', input.accountId)
        .in('id', triggerIds);
      if (error) throw new Error(error.message);

      const types = new Map(
        (triggers ?? []).map((t) => [t.id as string, t.trigger_type as string]),
      );
      for (const breaker of profile.ice_breakers) {
        if (types.get(breaker.trigger_id) !== 'ice_breaker') {
          throw new Error(
            'Each Ice Breaker must open an automation set to "Ice Breaker".',
          );
        }
      }
      for (const item of profile.persistent_menu) {
        if (
          item.type === 'postback' &&
          types.get(item.trigger_id) !== 'menu_payload'
        ) {
          throw new Error(
            'Each menu button must open an automation set to "Menu button".',
          );
        }
      }
    }

    const admin = getSupabaseServerAdminClient();
    const { data: igAccount } = await admin
      .from('ig_connected_accounts')
      .select('id, ig_business_account_id, access_token')
      .eq('account_id', input.accountId)
      .eq('is_active', true)
      .maybeSingle();
    if (!igAccount) throw new Error('Connect an Instagram account first');

    const accessToken = decryptIgToken(igAccount.access_token as string);

    await setIceBreakers(
      igAccount.ig_business_account_id as string,
      accessToken,
      profile.ice_breakers.map((b) => ({
        question: b.question,
        payload: buildEntryPayload(b.trigger_id),
      })),
    );

    const menu: IgMenuItem[] = profile.persistent_menu.map((item) =>
      item.type === 'postback'
        ? {
            type: 'postback',
            title: item.title,
            payload: buildEntryPayload(item.trigger_id),
          }
        : { type: 'web_url', title: item.title, url: item.url },
    );
    await setPersistentMenu(
      igAccount.ig_business_account_id as string,
      accessToken,
      menu,
    );

    const { error: saveError } = await client
      .from('ig_connected_accounts')
      .update({
        messenger_profile: {
          ice_breakers: profile.ice_breakers,
          persistent_menu: profile.persistent_menu,
          synced_at: new Date().toISOString(),
        },
      })
      .eq('account_id', input.accountId);
    if (saveError) throw new Error(saveError.message);

    revalidatePath(
      pathsConfig.app.accountInstagramAutoreply.replace('[account]', slug),
    );
    return { ok: true as const };
  },
  { schema: saveMessengerProfileSchema },
);
