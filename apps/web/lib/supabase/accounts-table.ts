import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * `accounts` columns added via SQL migration (onboarding step, outbound
 * email toggles). Generated Database types land after Dan applies it.
 * TODO: remove this helper once `pnpm supabase:web:typegen` includes the columns.
 */
export function fromAccountsUntyped(client: SupabaseClient) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from('accounts');
}
