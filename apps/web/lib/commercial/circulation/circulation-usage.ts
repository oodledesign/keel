import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { CIRCULATION_INCLUDED_ALLOWANCE } from '~/lib/billing/campaign-pricing';

import type { CirculationUsageSnapshot } from './circulation-usage-types';

export type { CirculationUsageSnapshot } from './circulation-usage-types';

function fromTable(client: SupabaseClient, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from(table);
}

/**
 * Commercial Circulation included allowance stub.
 * Never reads or writes campaign_credit_pools.
 */
export async function loadCirculationUsageSnapshot(
  client: SupabaseClient,
  accountId: string,
  contactsUsed: number,
): Promise<CirculationUsageSnapshot> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any).rpc('ensure_circulation_credit_pool', {
      p_account_id: accountId,
    });
  } catch {
    // Migration may not be applied yet in older environments.
  }

  const { data } = await fromTable(client, 'circulation_credit_pools')
    .select('emails_sent, monthly_allowance, max_contacts, cycle_end')
    .eq('account_id', accountId)
    .maybeSingle();

  const row = data as {
    emails_sent?: number;
    monthly_allowance?: number;
    max_contacts?: number;
    cycle_end?: string | null;
  } | null;

  return {
    emailsSent: row?.emails_sent ?? 0,
    monthlyAllowance:
      row?.monthly_allowance ?? CIRCULATION_INCLUDED_ALLOWANCE.sendUnits,
    maxContacts:
      row?.max_contacts ?? CIRCULATION_INCLUDED_ALLOWANCE.maxContacts,
    contactsUsed,
    cycleEnd: row?.cycle_end ?? null,
  };
}
