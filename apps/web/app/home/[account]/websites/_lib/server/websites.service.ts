import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import type {
  GetWebsiteInput,
  ListWebsitesInput,
  UpdateWebsiteInput,
  WebsiteInput,
  WebsiteStack,
  WebsiteStatus,
} from '../schema/websites.schema';
import {
  isMissingColumnError,
  isMissingRelationError,
  logMissingRelation,
} from '../../../_lib/server/supabase-errors';

export type Website = {
  id: string;
  businessId: string;
  clientOrgId: string | null;
  name: string;
  domain: string | null;
  stagingUrl: string | null;
  stack: WebsiteStack;
  cmsAdminUrl: string | null;
  vercelProjectId: string | null;
  githubRepoUrl: string | null;
  supabaseSchema: string | null;
  status: WebsiteStatus;
  umamiWebsiteId: string | null;
  umamiShareUrl: string | null;
  notes: string | null;
  hostingNotes: string | null;
  launchedAt: string | null;
  createdAt: string;
  updatedAt: string;
  clientOrgName: string | null;
  linkedClientId: string | null;
};

export type ClientOrgOption = {
  id: string;
  name: string;
};

type WebsiteRow = {
  id: string;
  business_id: string;
  client_org_id?: string | null;
  name?: string | null;
  domain?: string | null;
  staging_url?: string | null;
  stack?: string | null;
  cms_admin_url?: string | null;
  vercel_project_id?: string | null;
  github_repo_url?: string | null;
  supabase_schema?: string | null;
  status?: string | null;
  umami_website_id?: string | null;
  umami_share_url?: string | null;
  notes?: string | null;
  hosting_notes?: string | null;
  launched_at?: string | null;
  created_at?: string;
  updated_at?: string;
  client_orgs?: { name?: string | null } | { name?: string | null }[] | null;
};

type ClientOrgRow = {
  id: string;
  name?: string | null;
};

type ClientRow = {
  id: string;
  client_org_id?: string | null;
};

function mapWebsiteWriteError(err: unknown): Error {
  const e = err as {
    message?: string;
    code?: string;
    details?: string;
  };
  const msg = typeof e?.message === 'string' ? e.message : '';
  const details = typeof e?.details === 'string' ? e.details : '';
  const blob = `${msg} ${details}`.toLowerCase();

  if (
    e?.code === '42501' ||
    /row-level security/i.test(blob) ||
    /violates row-level security/i.test(blob)
  ) {
    return new Error(
      'Could not save website: database blocked this action (row-level security). Run the latest migrations from apps/web (`pnpm exec supabase db push`).',
    );
  }

  if (isMissingColumnError(err)) {
    return new Error(
      'Could not save website: the websites table is missing columns expected by Ozer. Run migrations from apps/web (`pnpm exec supabase db push`).',
    );
  }

  if (isMissingRelationError(err)) {
    return new Error(
      'Could not save website: the websites table is not set up on this project. Run migrations from apps/web (`pnpm exec supabase db push`).',
    );
  }

  if (e?.code === '23505' || msg.includes('duplicate key')) {
    return new Error(
      'Could not save website: a website with this name or domain already exists in this workspace.',
    );
  }

  if (e?.code === '23503') {
    if (blob.includes('businesses')) {
      return new Error(
        'Could not save website: the database still ties websites to legacy businesses, not your team workspace. From apps/web run `pnpm exec supabase db push` (migration 20260601100000_repair_websites_business_fk_to_accounts.sql).',
      );
    }
    if (blob.includes('accounts')) {
      return new Error(
        'That workspace id is not present in public.accounts. Reload the page or open Websites from a valid team workspace.',
      );
    }
    return new Error(
      `Could not save website (invalid reference). ${details || msg}`.trim(),
    );
  }

  return err instanceof Error ? err : new Error(msg || 'Failed to save website');
}

function mapWebsite(row: WebsiteRow, linkedClientId: string | null = null): Website {
  const org = Array.isArray(row.client_orgs)
    ? row.client_orgs[0]
    : row.client_orgs;

  return {
    id: row.id,
    businessId: row.business_id,
    clientOrgId: row.client_org_id ?? null,
    name: row.name ?? 'Untitled',
    domain: row.domain ?? null,
    stagingUrl: row.staging_url ?? null,
    stack: (row.stack as WebsiteStack) ?? 'other',
    cmsAdminUrl: row.cms_admin_url ?? null,
    vercelProjectId: row.vercel_project_id ?? null,
    githubRepoUrl: row.github_repo_url ?? null,
    supabaseSchema: row.supabase_schema ?? null,
    status: (row.status as WebsiteStatus) ?? 'in-progress',
    umamiWebsiteId: row.umami_website_id ?? null,
    umamiShareUrl: row.umami_share_url ?? null,
    notes: row.notes ?? null,
    hostingNotes: row.hosting_notes ?? null,
    launchedAt: row.launched_at ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
    clientOrgName: org?.name?.trim() ?? null,
    linkedClientId,
  };
}

function toDbPayload(input: Omit<WebsiteInput, 'accountId'> | UpdateWebsiteInput) {
  return {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.domain !== undefined && { domain: input.domain }),
    ...(input.staging_url !== undefined && { staging_url: input.staging_url }),
    ...(input.stack !== undefined && { stack: input.stack }),
    ...(input.status !== undefined && { status: input.status }),
    ...(input.client_org_id !== undefined && {
      client_org_id: input.client_org_id,
    }),
    ...(input.cms_admin_url !== undefined && {
      cms_admin_url: input.cms_admin_url,
    }),
    ...(input.vercel_project_id !== undefined && {
      vercel_project_id: input.vercel_project_id,
    }),
    ...(input.github_repo_url !== undefined && {
      github_repo_url: input.github_repo_url,
    }),
    ...(input.supabase_schema !== undefined && {
      supabase_schema: input.supabase_schema,
    }),
    ...(input.notes !== undefined && { notes: input.notes }),
    ...(input.hosting_notes !== undefined && {
      hosting_notes: input.hosting_notes,
    }),
    ...(input.launched_at !== undefined && { launched_at: input.launched_at }),
    ...(input.umami_website_id !== undefined && {
      umami_website_id: input.umami_website_id,
    }),
    ...(input.umami_share_url !== undefined && {
      umami_share_url: input.umami_share_url,
    }),
  };
}

export function createWebsitesService(client: SupabaseClient) {
  return new WebsitesService(client);
}

class WebsitesService {
  constructor(private readonly client: SupabaseClient) {}

  private get db(): SupabaseClient {
    return this.client;
  }

  /** Writes after permission checks; bypasses RLS drift (same pattern as clients). */
  private get adminDb(): SupabaseClient {
    return getSupabaseServerAdminClient();
  }

  private async enrichWebsiteRow(
    accountId: string,
    row: WebsiteRow,
  ): Promise<Website> {
    let enriched = row;

    if (row.client_org_id && !row.client_orgs) {
      const { data } = await this.db
        .from('client_orgs')
        .select('name')
        .eq('id', row.client_org_id)
        .eq('business_id', accountId)
        .maybeSingle();

      if (data) {
        enriched = { ...row, client_orgs: { name: data.name } };
      }
    }

    let linkedClientId: string | null = null;
    if (row.client_org_id) {
      const linked = await this.resolveLinkedClientIds(accountId, [
        row.client_org_id,
      ]);
      linkedClientId = linked.get(row.client_org_id) ?? null;
    }

    return mapWebsite(enriched, linkedClientId);
  }

  private async saveWebsiteRow(
    accountId: string,
    payload: Record<string, unknown>,
    mode: 'insert' | 'update',
    websiteId?: string,
  ): Promise<Website> {
    const timestamp = new Date().toISOString();

    const result =
      mode === 'insert'
        ? await this.adminDb
            .from('websites')
            .insert({
              business_id: accountId,
              ...payload,
              updated_at: timestamp,
            })
            .select('*')
            .single()
        : await this.adminDb
            .from('websites')
            .update({
              ...payload,
              updated_at: timestamp,
            })
            .eq('id', websiteId!)
            .eq('business_id', accountId)
            .select('*')
            .single();

    if (result.error || !result.data) {
      throw mapWebsiteWriteError(
        result.error ?? new Error('Failed to save website'),
      );
    }

    return this.enrichWebsiteRow(accountId, result.data as WebsiteRow);
  }

  private throwErr(err: unknown, fallback = 'Something went wrong'): never {
    if (err instanceof Error) throw err;
    const msg =
      err &&
      typeof err === 'object' &&
      'message' in err &&
      typeof (err as { message: unknown }).message === 'string'
        ? (err as { message: string }).message
        : fallback;
    throw new Error(msg);
  }

  private async ensureUser() {
    const { data: user } = await requireUser(this.client);
    if (!user) throw new Error('Authentication required');
    return user;
  }

  private async ensureOwnerOrAdmin(accountId: string) {
    const user = await this.ensureUser();
    const { data, error } = await this.db
      .from('accounts_memberships')
      .select('account_role')
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) this.throwErr(error);
    const role = data?.account_role;
    if (role !== 'owner' && role !== 'admin') {
      throw new Error('Only account owners and admins can perform this action');
    }

    return user;
  }

  private async ensureCanView(accountId: string) {
    const user = await this.ensureUser();
    const { data, error } = await this.db
      .from('accounts_memberships')
      .select('account_role')
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) this.throwErr(error);
    const role = data?.account_role;
    if (!role || role === 'contractor' || role === 'client') {
      throw new Error('Permission denied');
    }

    return user;
  }

  private async listWebsiteRows(input: ListWebsitesInput): Promise<WebsiteRow[]> {
    let query = this.db
      .from('websites')
      .select('*, client_orgs(name)')
      .eq('business_id', input.accountId)
      .order('name');

    if (input.status) {
      query = query.eq('status', input.status);
    }

    const { data, error } = await query;

    if (!error) {
      return (data ?? []) as WebsiteRow[];
    }

    if (isMissingRelationError(error)) {
      logMissingRelation('websites.listWebsiteRows', error);
      return [];
    }

    console.error('[websites] listWebsites embed error:', error.message);

    let fallbackQuery = this.db
      .from('websites')
      .select('*')
      .eq('business_id', input.accountId)
      .order('name');

    if (input.status) {
      fallbackQuery = fallbackQuery.eq('status', input.status);
    }

    const fallback = await fallbackQuery;
    if (fallback.error) {
      console.error('[websites] listWebsites error:', fallback.error.message);
      return [];
    }

    return (fallback.data ?? []) as WebsiteRow[];
  }

  private async resolveLinkedClientIds(
    accountId: string,
    orgIds: string[],
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (orgIds.length === 0) return map;

    const { data } = await this.db
      .from('clients')
      .select('id, client_org_id')
      .eq('account_id', accountId)
      .in('client_org_id', orgIds);

    for (const row of (data ?? []) as ClientRow[]) {
      if (row.client_org_id && !map.has(row.client_org_id)) {
        map.set(row.client_org_id, row.id);
      }
    }

    return map;
  }

  async listWebsites(input: ListWebsitesInput): Promise<Website[]> {
    await this.ensureCanView(input.accountId);

    const rows = await this.listWebsiteRows(input);
    const orgIds = [
      ...new Set(
        rows
          .map((row) => row.client_org_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const linkedClients = await this.resolveLinkedClientIds(
      input.accountId,
      orgIds,
    );

    return rows.map((row) =>
      mapWebsite(row, row.client_org_id ? linkedClients.get(row.client_org_id) ?? null : null),
    );
  }

  async getWebsite(input: GetWebsiteInput): Promise<Website | null> {
    await this.ensureCanView(input.accountId);

    const { data, error } = await this.db
      .from('websites')
      .select('*, client_orgs(name)')
      .eq('id', input.websiteId)
      .eq('business_id', input.accountId)
      .maybeSingle();

    if (error) {
      console.error('[websites] getWebsite embed error:', error.message);
      const fallback = await this.db
        .from('websites')
        .select('*')
        .eq('id', input.websiteId)
        .eq('business_id', input.accountId)
        .maybeSingle();

      if (fallback.error || !fallback.data) return null;
      return this.enrichWebsiteRow(input.accountId, fallback.data as WebsiteRow);
    }

    if (!data) return null;

    return this.enrichWebsiteRow(input.accountId, data as WebsiteRow);
  }

  async listClientOrgs(accountId: string): Promise<ClientOrgOption[]> {
    await this.ensureCanView(accountId);

    const { data, error } = await this.db
      .from('client_orgs')
      .select('id, name')
      .eq('business_id', accountId)
      .order('name');

    if (error) {
      console.error('[websites] listClientOrgs error:', error.message);
      return [];
    }

    return ((data ?? []) as ClientOrgRow[])
      .map((row) => ({
        id: row.id,
        name: row.name?.trim() || 'Unnamed client',
      }))
      .filter((row) => row.id);
  }

  async createWebsite(input: WebsiteInput): Promise<Website> {
    await this.ensureOwnerOrAdmin(input.accountId);

    const { accountId, ...fields } = input;
    return this.saveWebsiteRow(accountId, toDbPayload(fields), 'insert');
  }

  async updateWebsite(
    accountId: string,
    input: UpdateWebsiteInput,
  ): Promise<Website> {
    await this.ensureOwnerOrAdmin(accountId);

    const { websiteId, ...fields } = input;
    return this.saveWebsiteRow(
      accountId,
      toDbPayload(fields),
      'update',
      websiteId,
    );
  }

  async deleteWebsite(accountId: string, websiteId: string): Promise<void> {
    await this.ensureOwnerOrAdmin(accountId);

    const { error } = await this.adminDb
      .from('websites')
      .delete()
      .eq('id', websiteId)
      .eq('business_id', accountId);

    if (error) throw mapWebsiteWriteError(error);
  }
}
