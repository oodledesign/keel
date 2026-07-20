import 'server-only';

import { cache } from 'react';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import type { Database } from '~/lib/database.types';

import {
  type WorkspaceCurrency,
  normalizeWorkspaceCurrency,
} from './workspace-currency';

async function fetchWorkspaceCurrency(
  client: SupabaseClient<Database>,
  accountId: string,
): Promise<WorkspaceCurrency> {
  const { data, error } = await client
    .from('accounts')
    .select('default_currency')
    .eq('id', accountId)
    .maybeSingle();

  if (error) {
    console.error('[getWorkspaceCurrency]', error.message);
  }

  if (data?.default_currency) {
    return normalizeWorkspaceCurrency(data.default_currency);
  }

  const { data: paymentSettings } = await client
    .from('account_payment_settings')
    .select('default_invoice_currency')
    .eq('account_id', accountId)
    .maybeSingle();

  return normalizeWorkspaceCurrency(paymentSettings?.default_invoice_currency);
}

export const getWorkspaceCurrency = cache(async (accountId: string) => {
  const client = getSupabaseServerClient();
  return fetchWorkspaceCurrency(client, accountId);
});

export async function getWorkspaceCurrencyWithClient(
  client: SupabaseClient<Database>,
  accountId: string,
): Promise<WorkspaceCurrency> {
  return fetchWorkspaceCurrency(client, accountId);
}
