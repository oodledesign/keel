import 'server-only';

/**
 * Optional helper for public booking / client portal routes.
 *
 * DECISION (Dan): by default these surfaces stay live even when the agency
 * workspace is past_due_restricted or suspended, so clients are not disrupted.
 * Pass `treatDecisionAs: 'blocked'` once product confirms otherwise.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  accountAllowsCapability,
  type AccountAccessCapability,
  type AccountAccessLevel,
} from './account-access-matrix';
import { checkAccountAccess } from './check-account-access';

type AnyClient = SupabaseClient<any>;

export async function checkPublicSurfaceAccess(
  client: AnyClient,
  accountId: string,
  surface: Extract<
    AccountAccessCapability,
    'public_booking_pages' | 'client_portal'
  >,
  options?: { treatDecisionAs?: 'allowed' | 'blocked' },
): Promise<{ allowed: boolean; level: AccountAccessLevel; reason: string }> {
  const access = await checkAccountAccess(client, accountId);
  const allowed = accountAllowsCapability(access.level, surface, {
    treatDecisionAs: options?.treatDecisionAs ?? 'allowed',
  });

  return {
    allowed,
    level: access.level,
    reason: access.reason,
  };
}
