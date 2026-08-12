'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

import {
  COMMERCIAL_NAV_TOGGLE_KEYS,
  saveCommercialNavModulesSchema,
} from '../schema/commercial-nav-modules.schema';
import { assertCanEditBrandSettings } from './brand-settings-access';

function workPath(template: string, accountSlug: string) {
  return template.replace('[account]', accountSlug);
}

export const saveCommercialNavModules = enhanceAction(
  async (input, user) => {
    const { accountSlug } = await assertCanEditBrandSettings(
      input.accountId,
      user.id,
    );

    const client = getSupabaseServerClient();
    const rows = COMMERCIAL_NAV_TOGGLE_KEYS.map((moduleKey) => ({
      account_id: input.accountId,
      module_key: moduleKey,
      enabled: input.modules[moduleKey] ?? moduleKey !== 'proposals',
    }));

    const { error } = await client
      .from('account_module_settings')
      .upsert(rows, {
        onConflict: 'account_id,module_key',
      });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(workPath(pathsConfig.app.accountSettings, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountHome, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountListings, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountPipeline, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountLeases, accountSlug));

    return { ok: true as const };
  },
  { schema: saveCommercialNavModulesSchema },
);
