import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';

import { RETAINER_WORKSPACE_ROLES } from '~/lib/retainers/constants';
import {
  DEFAULT_WORKSPACE_RETAINER_CATEGORIES,
  DEFAULT_WORKSPACE_RETAINER_SERVICES,
} from '~/lib/retainers/default-library';
import type { ServiceCategory } from '~/lib/retainers/effective-services';
import { looseClient } from '~/lib/retainers/loose-client';
import { assertCategoryOnAccount } from '~/lib/retainers/persist-service-list';
import { mapRetainerService } from '~/lib/retainers/map-records';
import type { RetainerServiceRecord } from '~/lib/retainers/types';

import type {
  PatchRetainerServiceInput,
  UpsertRetainerServiceCategoryInput,
  UpsertRetainerServiceInput,
} from '../schema/retainer-services.schema';

function db(client: SupabaseClient) {
  return looseClient(client);
}

function mapCategory(row: Record<string, unknown>): ServiceCategory {
  return {
    id: String(row.id),
    name: String(row.name ?? '').trim() || 'Untitled',
    sortOrder: Number(row.sort_order ?? 0),
  };
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
    return (data ?? [])
      .map((row: Record<string, unknown>) => mapRetainerService(row))
      .filter((row) => row.scope === 'workspace');
  }

  async listCategories(accountId: string): Promise<ServiceCategory[]> {
    await this.ensureMember(accountId);
    const { data, error } = await db(this.client)
      .from('retainer_service_categories')
      .select('id, name, sort_order')
      .eq('account_id', accountId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw error;
    return ((data ?? []) as Array<Record<string, unknown>>).map(mapCategory);
  }

  async upsert(
    input: UpsertRetainerServiceInput,
  ): Promise<RetainerServiceRecord> {
    await this.ensureMember(input.accountId);
    await assertCategoryOnAccount(db(this.client), {
      accountId: input.accountId,
      categoryId: input.categoryId,
    });

    const payload = {
      name: input.name,
      description: input.description?.trim() || null,
      credit_cost: input.creditCost,
      default_status: input.defaultStatus ?? null,
      default_assignee_id: input.defaultAssigneeId ?? null,
      default_duration_minutes: input.defaultDurationMinutes ?? null,
      sort_order: input.sortOrder,
      is_active: input.isActive,
      is_visible: input.isVisible,
      category_id: input.categoryId ?? null,
      request_type_id: input.requestTypeId ?? null,
      scope: 'workspace',
      client_id: null,
      project_id: null,
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

  async patch(
    input: PatchRetainerServiceInput,
  ): Promise<RetainerServiceRecord> {
    await this.ensureMember(input.accountId);
    if (input.categoryId !== undefined) {
      await assertCategoryOnAccount(db(this.client), {
        accountId: input.accountId,
        categoryId: input.categoryId,
      });
    }
    const payload: Record<string, unknown> = {};
    if (input.isVisible !== undefined) payload.is_visible = input.isVisible;
    if (input.categoryId !== undefined) payload.category_id = input.categoryId;
    if (Object.keys(payload).length === 0) {
      throw new Error('Nothing to update');
    }
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

  async upsertCategory(
    input: UpsertRetainerServiceCategoryInput,
  ): Promise<ServiceCategory> {
    await this.ensureMember(input.accountId);
    const name = input.name.trim();

    if (input.id) {
      const payload: Record<string, unknown> = { name };
      if (input.sortOrder !== undefined) payload.sort_order = input.sortOrder;
      const { data, error } = await db(this.client)
        .from('retainer_service_categories')
        .update(payload)
        .eq('id', input.id)
        .eq('account_id', input.accountId)
        .select('id, name, sort_order')
        .single();
      if (error) throw error;
      return mapCategory(data as Record<string, unknown>);
    }

    const existing = await this.listCategories(input.accountId);
    const nextSort =
      input.sortOrder ??
      existing.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;

    const { data, error } = await db(this.client)
      .from('retainer_service_categories')
      .insert({
        account_id: input.accountId,
        name,
        sort_order: nextSort,
      })
      .select('id, name, sort_order')
      .single();
    if (error) throw error;
    return mapCategory(data as Record<string, unknown>);
  }

  async deleteCategory(accountId: string, id: string) {
    await this.ensureMember(accountId);
    const { error } = await db(this.client)
      .from('retainer_service_categories')
      .delete()
      .eq('id', id)
      .eq('account_id', accountId);
    if (error) throw error;
    return { ok: true as const };
  }

  async reorderCategories(accountId: string, ids: string[]) {
    await this.ensureMember(accountId);
    await Promise.all(
      ids.map((id, index) =>
        db(this.client)
          .from('retainer_service_categories')
          .update({ sort_order: index })
          .eq('id', id)
          .eq('account_id', accountId),
      ),
    );
    return this.listCategories(accountId);
  }

  private async seedCategoriesIfEmpty(
    accountId: string,
  ): Promise<ServiceCategory[]> {
    const existing = await this.listCategories(accountId);
    if (existing.length > 0) return existing;

    const { error } = await db(this.client)
      .from('retainer_service_categories')
      .insert(
        DEFAULT_WORKSPACE_RETAINER_CATEGORIES.map((row) => ({
          account_id: accountId,
          name: row.name,
          sort_order: row.sortOrder,
        })),
      );
    if (error) throw error;
    return this.listCategories(accountId);
  }

  async seedDefaultsIfEmpty(
    accountId: string,
  ): Promise<RetainerServiceRecord[]> {
    await this.ensureMember(accountId);
    const existing = await this.list(accountId);
    if (existing.length > 0) return existing;

    const categories = await this.seedCategoriesIfEmpty(accountId);
    const categoryByName = new Map(
      categories.map((row) => [row.name.toLowerCase(), row.id]),
    );

    const { error } = await db(this.client)
      .from('retainer_services')
      .insert(
        DEFAULT_WORKSPACE_RETAINER_SERVICES.map((row) => ({
          account_id: accountId,
          name: row.name,
          description: row.description,
          credit_cost: row.creditCost,
          default_duration_minutes: row.defaultDurationMinutes,
          sort_order: row.sortOrder,
          is_active: true,
          is_visible: true,
          scope: 'workspace',
          category_id: row.categoryName
            ? (categoryByName.get(row.categoryName.toLowerCase()) ?? null)
            : null,
        })),
      );
    if (error) throw error;
    return this.list(accountId);
  }
}
