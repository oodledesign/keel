import type { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';

import {
  PROJECT_STATUS_COLOR_PRESETS,
  type ProjectStatus,
  type ProjectStatusCategory,
  uniqueProjectStatusSlug,
} from '~/lib/projects/project-statuses';

import type {
  CreateProjectStatusInput,
  DeleteProjectStatusInput,
  ReorderProjectStatusesInput,
  UpdateProjectStatusInput,
} from '../schema/project-statuses.schema';

type ProjectStatusRow = {
  id: string;
  account_id: string;
  slug: string;
  label: string;
  color: string;
  sort_order: number;
  is_default: boolean;
  category: string;
};

const SELECT =
  'id, account_id, slug, label, color, sort_order, is_default, category';

function mapRow(row: ProjectStatusRow): ProjectStatus {
  return {
    id: row.id,
    accountId: row.account_id,
    slug: row.slug,
    label: row.label,
    color: row.color,
    sortOrder: row.sort_order,
    isDefault: row.is_default,
    category: row.category as ProjectStatusCategory,
  };
}

function throwErr(err: unknown, fallback = 'Something went wrong'): never {
  if (err instanceof Error) throw err;
  const message =
    err &&
    typeof err === 'object' &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
      ? (err as { message: string }).message
      : fallback;
  throw new Error(message);
}

export function createProjectStatusesService(client: SupabaseClient) {
  return new ProjectStatusesService(client);
}

class ProjectStatusesService {
  constructor(private readonly db: SupabaseClient) {}

  private async ensureUser() {
    const { data: user } = await requireUser(this.db);
    if (!user) throw new Error('Authentication required');
    return user;
  }

  private async ensureAdmin(accountId: string) {
    const user = await this.ensureUser();
    if (accountId === user.id) return user;

    const { data, error } = await this.db
      .from('accounts_memberships')
      .select('account_role')
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throwErr(error);
    const role = data?.account_role as string | undefined;
    if (role !== 'owner' && role !== 'admin') {
      throw new Error('Only workspace owners and admins can manage statuses');
    }
    return user;
  }

  private async loadRows(accountId: string): Promise<ProjectStatus[]> {
    const { data, error } = await this.db
      .from('project_statuses')
      .select(SELECT)
      .eq('account_id', accountId)
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true });

    if (error) throwErr(error);
    return ((data ?? []) as ProjectStatusRow[]).map(mapRow);
  }

  async list(accountId: string): Promise<ProjectStatus[]> {
    await this.ensureUser();

    let rows = await this.loadRows(accountId);
    if (rows.length > 0) return rows;

    const { error } = await this.db.rpc('seed_default_project_statuses', {
      target_account_id: accountId,
    });
    if (error) throwErr(error);

    rows = await this.loadRows(accountId);
    return rows;
  }

  async create(input: CreateProjectStatusInput): Promise<ProjectStatus> {
    await this.ensureAdmin(input.accountId);
    const existing = await this.loadRows(input.accountId);
    const slug = uniqueProjectStatusSlug(
      input.label,
      existing.map((row) => row.slug),
    );
    const color =
      input.color ??
      PROJECT_STATUS_COLOR_PRESETS[
        existing.length % PROJECT_STATUS_COLOR_PRESETS.length
      ]!;

    if (input.isDefault) {
      await this.clearDefault(input.accountId);
    }

    const { data, error } = await this.db
      .from('project_statuses')
      .insert({
        account_id: input.accountId,
        slug,
        label: input.label.trim(),
        color,
        category: input.category ?? 'open',
        is_default: input.isDefault ?? existing.length === 0,
        sort_order: existing.length,
      })
      .select(SELECT)
      .single();

    if (error) throwErr(error);
    return mapRow(data as ProjectStatusRow);
  }

  async update(input: UpdateProjectStatusInput): Promise<ProjectStatus> {
    await this.ensureAdmin(input.accountId);
    const existing = await this.requireStatus(input.accountId, input.id);
    const payload: Record<string, unknown> = {};

    if (input.label !== undefined) payload.label = input.label.trim();
    if (input.color !== undefined) payload.color = input.color;
    if (input.category !== undefined) payload.category = input.category;

    if (input.slug && input.slug !== existing.slug) {
      const clash = await this.loadRows(input.accountId);
      if (clash.some((row) => row.slug === input.slug && row.id !== input.id)) {
        throw new Error('Another status already uses that key');
      }
      payload.slug = input.slug;
    }

    if (input.isDefault === true && !existing.isDefault) {
      await this.clearDefault(input.accountId);
      payload.is_default = true;
    } else if (input.isDefault === false && existing.isDefault) {
      throw new Error('Choose another default status first');
    }

    if (Object.keys(payload).length === 0) {
      return existing;
    }

    const { data, error } = await this.db
      .from('project_statuses')
      .update(payload)
      .eq('id', input.id)
      .eq('account_id', input.accountId)
      .select(SELECT)
      .maybeSingle();

    if (error) throwErr(error);
    if (!data) throw new Error('Status not found');

    if (payload.slug) {
      const { error: remapError } = await this.db
        .from('projects')
        .update({ status: payload.slug })
        .eq('account_id', input.accountId)
        .eq('project_type', 'delivery')
        .eq('status', existing.slug);

      if (remapError) throwErr(remapError);
    }

    return mapRow(data as ProjectStatusRow);
  }

  async reorder(input: ReorderProjectStatusesInput): Promise<ProjectStatus[]> {
    await this.ensureAdmin(input.accountId);
    const existing = await this.loadRows(input.accountId);
    const existingIds = new Set(existing.map((row) => row.id));

    if (
      input.orderedIds.length !== existing.length ||
      input.orderedIds.some((id) => !existingIds.has(id))
    ) {
      throw new Error('Status list is out of date. Refresh and try again.');
    }

    const { error } = await this.db.rpc('reorder_workspace_project_statuses', {
      target_account_id: input.accountId,
      ordered_ids: input.orderedIds,
    });
    if (error) throwErr(error);

    return this.loadRows(input.accountId);
  }

  async delete(input: DeleteProjectStatusInput): Promise<void> {
    await this.ensureAdmin(input.accountId);
    const existing = await this.loadRows(input.accountId);
    const target = existing.find((row) => row.id === input.id);
    if (!target) throw new Error('Status not found');
    if (existing.length <= 1) {
      throw new Error('Keep at least one project status');
    }

    const inUse = await this.countProjects(input.accountId, target.slug);
    if (inUse > 0) {
      if (!input.remapToId) {
        throw new Error(
          `${inUse} project${inUse === 1 ? '' : 's'} use this status. Choose a status to move them to.`,
        );
      }
      if (input.remapToId === input.id) {
        throw new Error('Choose a different status to move projects to');
      }
      if (!existing.some((row) => row.id === input.remapToId)) {
        throw new Error('Replacement status not found');
      }
    }

    const { error } = await this.db.rpc('delete_workspace_project_status', {
      target_account_id: input.accountId,
      target_status_id: input.id,
      remap_to_id: input.remapToId ?? null,
    });
    if (error) throwErr(error);
  }

  private async requireStatus(
    accountId: string,
    id: string,
  ): Promise<ProjectStatus> {
    const { data, error } = await this.db
      .from('project_statuses')
      .select(SELECT)
      .eq('account_id', accountId)
      .eq('id', id)
      .maybeSingle();

    if (error) throwErr(error);
    if (!data) throw new Error('Status not found');
    return mapRow(data as ProjectStatusRow);
  }

  private async clearDefault(accountId: string) {
    const { error } = await this.db
      .from('project_statuses')
      .update({ is_default: false })
      .eq('account_id', accountId)
      .eq('is_default', true);

    if (error) throwErr(error);
  }

  private async countProjects(
    accountId: string,
    slug: string,
  ): Promise<number> {
    const { count, error } = await this.db
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .eq('project_type', 'delivery')
      .eq('status', slug);

    if (error) throwErr(error);
    return count ?? 0;
  }
}
