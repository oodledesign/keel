import 'server-only';

import { cache } from 'react';

import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { canUseEmailAssistant } from './entitlements';

const cachedCanUseEmailAssistant = cache(async (userId: string) => {
  const client = getSupabaseServerClient();
  return canUseEmailAssistant(client, userId);
});

export async function redirectIfEmailAssistantNotAllowed(): Promise<void> {
  const user = await requireUserInServerComponent();
  const allowed = await cachedCanUseEmailAssistant(user.id);

  if (!allowed) {
    redirect(`${pathsConfig.app.personalAccountBilling}?addon=email-assistant`);
  }
}
