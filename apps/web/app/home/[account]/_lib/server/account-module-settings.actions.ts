'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

import { databaseModuleKeysForProfile } from '../database-module-keys';
import type { WorkspaceProfile } from '../workspace-profile';

function revalidateWorkspaceNav(accountSlug: string) {
  const home = pathsConfig.app.accountHome.replace('[account]', accountSlug);
  revalidatePath(home);
  revalidatePath(home, 'layout');
  revalidatePath(
    pathsConfig.app.accountSettings.replace('[account]', accountSlug),
  );
}

const restoreModulesSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  workspaceProfile: z.enum([
    'work_design',
    'work_property',
    'family',
    'community',
  ]),
});

/** Re-enable every module for this workspace (fixes empty sidebar nav). */
export const restoreWorkspaceModules = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      throw new Error('You must be signed in');
    }

    const { data: membership } = await client
      .from('accounts_memberships')
      .select('account_role')
      .eq('account_id', input.accountId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (
      !membership ||
      !['owner', 'admin'].includes(membership.account_role ?? '')
    ) {
      throw new Error('Only workspace owners and admins can restore modules');
    }

    const keys = databaseModuleKeysForProfile(
      input.workspaceProfile as WorkspaceProfile,
    );

    const rows = keys.map((module_key) => ({
      account_id: input.accountId,
      module_key,
      enabled: true,
    }));

    const { error } = await client.from('account_module_settings').upsert(rows, {
      onConflict: 'account_id,module_key',
    });

    if (error) {
      throw new Error(error.message);
    }

    revalidateWorkspaceNav(input.accountSlug);

    return { restored: keys.length };
  },
  { schema: restoreModulesSchema },
);
