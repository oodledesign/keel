import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  BUSINESS_LITE_ENTITLEMENT,
  hasBusinessLiteEntitlement,
} from './business-lite';
import { hasEntitlement } from './entitlements';

/** True when the workspace is on the free apps shell (not full Business CRM). */
export async function isBusinessLiteWorkspace(
  client: SupabaseClient,
  accountId: string,
  businessType?: string | null,
): Promise<boolean> {
  if ((businessType ?? '').trim().toLowerCase() === 'lite') {
    return true;
  }

  if (await hasEntitlement(client, accountId, 'workspace_business')) {
    return false;
  }

  return hasBusinessLiteEntitlement(client, accountId);
}

export { BUSINESS_LITE_ENTITLEMENT };
