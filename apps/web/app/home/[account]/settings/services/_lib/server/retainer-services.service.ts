import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';

import { RETAINER_WORKSPACE_ROLES } from '~/lib/retainers/constants';
import { looseClient } from '~/lib/retainers/loose-client';
import { mapRetainerService } from '~/lib/retainers/map-records';
import type { RetainerServiceRecord } from '~/lib/retainers/types';

import type { UpsertRetainerServiceInput } from '../schema/retainer-services.schema';

function db(client: SupabaseClient) {
  return looseClient(client);
}

export function createRetainerServicesService(client: SupabaseClient) {
  return new RetainerServicesService(client);
}

class RetainerServicesService {
  constructor(private readonly client: SupabaseClient) {}

  private async ensureMember(accountId: string) {
    const auth = await requireUser(this.client);
    if (!auth.data) throw new Error('Unauthorised');
    const { data: membership } = await this.client
      .from('accounts_memberships')
      .select('account_role')
      .eq('account_id', accountId)
      .eq('user_id', auth.data.id)
      .maybeSingle();
    const role = membership?.account_role as string | undefined;
    if (!role || !RETAINER_WORKSPACE_ROLES.has(role)) {
      throw new Error('Forbidden');
    }
    return { userId: auth.data.id, role };
  }

  async list(
    accountId: string,
    opts?: { activeOnly?: boolean },
  ): Promise<RetainerServiceRecord[]> {
    await this.ensureMember(accountId);
    let q = db(this.client)
      .from('retainer_services')
      .select('*')
      .eq('account_id', accountId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (opts?.activeOnly) {
      q = q.eq('is_active', true);
    }
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((row: Record<string, unknown>) =>
      mapRetainerService(row),
    );
  }

  async upsert(
    input: UpsertRetainerServiceInput,
  ): Promise<RetainerServiceRecord> {
    await this.ensureMember(input.accountId);

    const payload = {
      name: input.name,
      description: input.description?.trim() || null,
      credit_cost: input.creditCost,
      default_status: input.defaultStatus ?? null,
      default_assignee_id: input.defaultAssigneeId ?? null,
      default_duration_minutes: input.defaultDurationMinutes ?? null,
      sort_order: input.sortOrder,
      is_active: input.isActive,
    };

    if (input.id) {
      const { data, error } = await db(this.client)
        .from('retainer_services')
        .update(payload)
        .eq('id', input.id)
        .eq('account_id', input.accountId)
        .select('*')
        .single();
      if (error) throw error;
      return mapRetainerService(data as Record<string, unknown>);
    }

    const { data: maxRow } = await db(this.client)
      .from('retainer_services')
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

    const { data, error } = await db(this.client)
      .from('retainer_services')
      .insert({
        account_id: input.accountId,
        ...payload,
        sort_order: nextSort,
      })
      .select('*')
      .single();
    if (error) throw error;
    return mapRetainerService(data as Record<string, unknown>);
  }

  async softDelete(accountId: string, id: string) {
    await this.ensureMember(accountId);
    const { error } = await db(this.client)
      .from('retainer_services')
      .update({ is_active: false })
      .eq('id', id)
      .eq('account_id', accountId);
    if (error) throw error;
    return { ok: true as const };
  }
}
