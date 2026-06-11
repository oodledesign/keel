import 'server-only';

import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { canUseAddon } from './entitlements';
import type { KeelAddonKey } from './keel-plan-catalog';

export async function redirectIfAddonNotAllowed(
  accountSlug: string,
  accountId: string,
  addonKey: KeelAddonKey,
) {
  const user = await requireUserInServerComponent();
  const client = getSupabaseServerClient();

  const allowed = await canUseAddon(client, user.id, accountId, addonKey);

  if (!allowed) {
    const billingPath = pathsConfig.app.accountBilling.replace(
      '[account]',
      accountSlug,
    );
    redirect(`${billingPath}?addon=${addonKey.replace('addon_', '')}`);
  }
}
