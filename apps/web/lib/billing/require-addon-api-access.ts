import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { jsonErr } from '~/lib/rankly/api-response';

import { canUseAddon } from './entitlements';
import type { OzerAddonKey, OzerPersonalAddonKey } from './ozer-plan-catalog';

const ADDON_MESSAGES: Record<string, string> = {
  addon_rankly:
    'Rankly add-on required. Subscribe from Billing in this workspace.',
  addon_signatures:
    'Signatures add-on required. Subscribe from Billing in this workspace.',
  addon_feedflow:
    'Feedflow add-on required. Subscribe from Billing in this workspace.',
  addon_email_assistant:
    'Email Assistant add-on required. Subscribe from Billing in your personal account.',
};

export async function denyUnlessAddonAccess(
  client: SupabaseClient,
  userId: string,
  accountId: string,
  addonKey: OzerAddonKey | OzerPersonalAddonKey,
) {
  const allowed = await canUseAddon(client, userId, accountId, addonKey);

  if (allowed) {
    return null;
  }

  return jsonErr(
    'FORBIDDEN',
    ADDON_MESSAGES[addonKey] ?? 'This feature requires an active add-on subscription.',
    403,
  );
}
