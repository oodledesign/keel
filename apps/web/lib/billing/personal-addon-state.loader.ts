import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { canUseEmailAssistant } from './entitlements';

export type PersonalAddonState = {
  emailAssistant: boolean;
};

export async function loadPersonalAddonState(
  client: SupabaseClient,
  userId: string,
): Promise<PersonalAddonState> {
  return {
    emailAssistant: await canUseEmailAssistant(client, userId),
  };
}
