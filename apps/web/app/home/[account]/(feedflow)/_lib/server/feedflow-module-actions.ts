'use server';

import { revalidatePath } from 'next/cache';

import { nanoid } from 'nanoid';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { assertFeedflowWriteAccess } from '~/lib/feedflow/assert-feedflow-write';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import {
  createFeedflowWidgetActionSchema,
  deleteFeedflowSocialAccountActionSchema,
} from '../schema/feedflow-module.schema';

function workPath(template: string, accountSlug: string) {
  return template.replace('[account]', accountSlug);
}

export const createFeedflowWidget = enhanceAction(
  async (input, user) => {
    const { client, slug: accountSlug } = await assertFeedflowWriteAccess(
      input.accountId,
      user.id,
    );

    const { data: social, error: se } = await supabaseCustomSchema(
      client,
      'feedflow',
    )
      .from('social_accounts')
      .select('id')
      .eq('id', input.socialAccountId)
      .eq('account_id', input.accountId)
      .maybeSingle();

    if (se || !social) {
      throw new Error('Social account not found for this workspace');
    }

    const embedKey = nanoid(24);

    const { data, error } = await supabaseCustomSchema(client, 'feedflow')
      .from('widgets')
      .insert({
        account_id: input.accountId,
        social_account_id: input.socialAccountId,
        name: input.name.trim(),
        embed_key: embedKey,
        settings: {},
      })
      .select('embed_key')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(
      workPath(pathsConfig.app.accountFeedflowWidgets, accountSlug),
    );
    revalidatePath(
      workPath(pathsConfig.app.accountFeedflowReviews, accountSlug),
    );
    return { ok: true as const, embedKey: data?.embed_key as string };
  },
  { schema: createFeedflowWidgetActionSchema },
);

export const deleteFeedflowSocialAccount = enhanceAction(
  async (input, user) => {
    const { client, slug: accountSlug } = await assertFeedflowWriteAccess(
      input.accountId,
      user.id,
    );

    const { error } = await supabaseCustomSchema(client, 'feedflow')
      .from('social_accounts')
      .delete()
      .eq('id', input.socialAccountId)
      .eq('account_id', input.accountId);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(
      workPath(pathsConfig.app.accountFeedflowSocialAccounts, accountSlug),
    );
    revalidatePath(
      workPath(pathsConfig.app.accountFeedflowReviews, accountSlug),
    );
    revalidatePath(
      workPath(pathsConfig.app.accountFeedflowWidgets, accountSlug),
    );
    return { ok: true as const };
  },
  { schema: deleteFeedflowSocialAccountActionSchema },
);
