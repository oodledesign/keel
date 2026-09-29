import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';

import type { CreditTopupPackInput } from '~/lib/credits/credit-topup-packs';
import { loadAccountCreditTopupPacks } from '~/lib/credits/load-credit-topup-packs.server';
import { looseClient } from '~/lib/retainers/loose-client';

export function createCreditTopupPacksService(client: SupabaseClient) {
  return new CreditTopupPacksService(client);
}

class CreditTopupPacksService {
  constructor(private readonly client: SupabaseClient) {}

  private get db() {
    return looseClient(this.client);
  }

  private async ensureOwnerOrAdmin(accountId: string) {
    const auth = await requireUser(this.client);
    if (!auth.data) throw new Error('Unauthorised');
    const { data: membership } = await this.client
      .from('accounts_memberships')
      .select('account_role')
      .eq('account_id', accountId)
      .eq('user_id', auth.data.id)
      .maybeSingle();
    const role = membership?.account_role as string | undefined;
    if (role !== 'owner' && role !== 'admin') {
      throw new Error('Only owners and admins can change top-up packs');
    }
  }

  async get(accountId: string) {
    return loadAccountCreditTopupPacks(this.client, accountId);
  }

  async update(accountId: string, packs: CreditTopupPackInput[] | null) {
    await this.ensureOwnerOrAdmin(accountId);

    const { error } = await this.db.from('account_credit_settings').upsert({
      account_id: accountId,
      topup_packs: packs
        ? packs.map((pack) => ({
            units: pack.units,
            totalPence: pack.totalPence,
          }))
        : null,
    });
    if (error) throw error;

    return this.get(accountId);
  }
}
