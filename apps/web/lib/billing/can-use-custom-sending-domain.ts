import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { hasEntitlement } from './entitlements';
import { isBusinessLiteWorkspace } from './is-business-lite-workspace';

/**
 * Custom sending domain (and per-feature From toggles) are Starter/Pro only.
 * Lite and unpaid business workspaces always send via the Ozer default domain.
 */
export async function canUseCustomSendingDomain(
  client: SupabaseClient,
  accountId: string,
  businessType?: string | null,
): Promise<boolean> {
  if (await isBusinessLiteWorkspace(client, accountId, businessType)) {
    return false;
  }

  const [pro, starter] = await Promise.all([
    hasEntitlement(client, accountId, 'workspace_business'),
    hasEntitlement(client, accountId, 'workspace_business_starter'),
  ]);

  return pro || starter;
}
