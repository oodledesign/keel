import 'server-only';

import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { canUseAddon } from './entitlements';
import {
  IN_DEVELOPMENT_WORKSPACE_ADDON_KEYS,
  type OzerAddonKey,
} from './ozer-plan-catalog';

export async function redirectIfAddonNotAllowed(
  accountSlug: string,
  accountId: string,
  addonKey: OzerAddonKey,
) {
  const user = await requireUserInServerComponent();
  const client = getSupabaseServerClient();

  const allowed = await canUseAddon(client, user.id, accountId, addonKey);

  if (!allowed) {
    const addonsPath = pathsConfig.app.accountAddonsSettings.replace(
      '[account]',
      accountSlug,
    );

    // In-development add-ons: catalog only (no checkout deep-link).
    if (IN_DEVELOPMENT_WORKSPACE_ADDON_KEYS.includes(addonKey)) {
      redirect(addonsPath);
    }

    redirect(`${addonsPath}?addon=${addonKey.replace('addon_', '')}`);
  }
}
