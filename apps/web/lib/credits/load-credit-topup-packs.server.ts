import 'server-only';

import { getLogger } from '@kit/shared/logger';

import { looseClient } from '~/lib/retainers/loose-client';

import { resolveCreditTopupPacks } from './credit-topup-packs';

export async function loadAccountCreditTopupPacks(
  client: unknown,
  accountId: string,
) {
  const { data, error } = await looseClient(client)
    .from('account_credit_settings')
    .select('topup_packs')
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) {
    const logger = await getLogger();
    logger.warn(
      { name: 'credits.topup-packs.load', accountId, error: error.message },
      'Could not read top-up pack settings; using defaults',
    );
    return resolveCreditTopupPacks(null);
  }

  return resolveCreditTopupPacks(data?.topup_packs ?? null);
}
