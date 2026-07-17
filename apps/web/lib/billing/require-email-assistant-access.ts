import 'server-only';

import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { canUseEmailAssistant } from './entitlements';

export async function redirectIfEmailAssistantNotAllowed(): Promise<void> {
  const user = await requireUserInServerComponent();
  const client = getSupabaseServerClient();
  const allowed = await canUseEmailAssistant(client, user.id);

  if (!allowed) {
    redirect(`${pathsConfig.app.personalAccountBilling}?addon=email-assistant`);
  }
}
