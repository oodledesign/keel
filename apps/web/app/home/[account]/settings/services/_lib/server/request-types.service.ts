import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';

import type { RequestTypeRecord } from '~/lib/credits/request-types-types';

export type { RequestTypeRecord } from '~/lib/credits/request-types-types';

function mapRequestType(row: Record<string, unknown>): RequestTypeRecord {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    businessId: row.business_id ? String(row.business_id) : null,
    label: String(row.label ?? ''),
    creditCost: Number(row.credit_cost ?? 0),
    isBillable: Boolean(row.is_billable ?? true),
    isSupport: Boolean(row.is_support ?? false),
    categoryGroup: row.category_group ? String(row.category_group) : null,
    sortOrder: Number(row.sort_order ?? 0),
    isActive: Boolean(row.is_active ?? true),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

export function createRequestTypesService(client: SupabaseClient) {
  return new RequestTypesService(client);
}

class RequestTypesService {
  constructor(private readonly db: SupabaseClient) {}

  private async ensureMember(accountId: string) {
    const auth = await requireUser(this.db);
    if (!auth.data) throw new Error('Unauthorised');
    const { data: membership } = await this.db
      .from('accounts_memberships')
      .select('account_role')
      .eq('account_id', accountId)
      .eq('user_id', auth.data.id)
      .maybeSingle();
    const role = membership?.account_role as string | undefined;
    if (!role || role === 'client' || role === 'contractor') {
      throw new Error('Forbidden');
    }
    return { userId: auth.data.id, role };
  }

  async list(
    accountId: string,
    opts?: { activeOnly?: boolean },
  ): Promise<RequestTypeRecord[]> {
    await this.ensureMember(accountId);
    let q = this.db
      .from('request_types')
      .select('*')
      .eq('account_id', accountId)
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true });
    if (opts?.activeOnly) {
      q = q.eq('is_active', true);
    }
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((row) =>
      mapRequestType(row as Record<string, unknown>),
    );
  }

  async upsert(input: {
    accountId: string;
    id?: string;
    label: string;
    creditCost: number;
    isBillable: boolean;
    isSupport: boolean;
    categoryGroup?: string | null;
    sortOrder: number;
    isActive: boolean;
  }): Promise<RequestTypeRecord> {
    await this.ensureMember(input.accountId);

    const payload = {
      label: input.label,
      credit_cost: input.creditCost,
      is_billable: input.isBillable,
      is_support: input.isSupport,
      category_group: input.categoryGroup?.trim() || null,
      sort_order: input.sortOrder,
      is_active: input.isActive,
    };

    if (input.id) {
      const { data, error } = await this.db
        .from('request_types')
        .update(payload)
        .eq('id', input.id)
        .eq('account_id', input.accountId)
        .select('*')
        .single();
      if (error) throw error;
      return mapRequestType(data as Record<string, unknown>);
    }

    const { data: maxRow } = await this.db
      .from('request_types')
      .select('sort_order')
      .eq('account_id', input.accountId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextSort =
      input.sortOrder > 0
        ? input.sortOrder
        : Number((maxRow as { sort_order?: number } | null)?.sort_order ?? -1) +
          1;

    const { data, error } = await this.db
      .from('request_types')
      .insert({
        account_id: input.accountId,
        ...payload,
        sort_order: nextSort,
      })
      .select('*')
      .single();
    if (error) throw error;
    return mapRequestType(data as Record<string, unknown>);
  }

  async softDelete(accountId: string, id: string) {
    await this.ensureMember(accountId);
    const { error } = await this.db
      .from('request_types')
      .update({ is_active: false })
      .eq('id', id)
      .eq('account_id', accountId);
    if (error) throw error;
    return { ok: true as const };
  }

  async reorder(accountId: string, orderedIds: string[]) {
    await this.ensureMember(accountId);
    for (let i = 0; i < orderedIds.length; i += 1) {
      const { error } = await this.db
        .from('request_types')
        .update({ sort_order: i })
        .eq('id', orderedIds[i]!)
        .eq('account_id', accountId);
      if (error) throw error;
    }
    return { ok: true as const };
  }
}
