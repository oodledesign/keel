'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { businessNavPreferenceRows } from '~/home/[account]/_lib/business-nav-preferences';

import { saveBusinessNavSchema } from '../schema/business-nav.schema';
import { assertCanEditBrandSettings } from './brand-settings-access';

export const saveBusinessNavAction = enhanceAction(
  async (input, user) => {
    const { accountSlug } = await assertCanEditBrandSettings(
      input.accountId,
      user.id,
    );

    const { error } = await getSupabaseServerClient()
      .from('account_module_settings')
      .upsert(businessNavPreferenceRows(input.accountId, input.visible), {
        onConflict: 'account_id,module_key',
      });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(
      pathsConfig.app.accountHome.replace('[account]', accountSlug),
      'layout',
    );

    return { ok: true as const };
  },
  { schema: saveBusinessNavSchema },
);
