import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  isMissingColumnError,
  isMissingRelationError,
  logMissingRelation,
} from '../../../_lib/server/supabase-errors';
import type {
  GetWebsiteInput,
  ListWebsitesInput,
  SetWebsitePortalVisibleInput,
  UpdateWebsiteInput,
  WebsiteInput,
  WebsiteStack,
  WebsiteStatus,
} from '../schema/websites.schema';

function slugifyClientOrg(name: string): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'client';

  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

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
  jobId: string | null;
  portalVisible: boolean;
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
  job_id?: string | null;
  portal_visible?: boolean | null;
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

  return err instanceof Error
    ? err
    : new Error(msg || 'Failed to save website');
}

function mapWebsite(
  row: WebsiteRow,
  linkedClientId: string | null = null,
): Website {
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
    jobId: row.job_id ?? null,
    portalVisible: row.portal_visible === true,
  };
}

function toDbPayload(input: {
  name?: string;
  domain?: string | null;
  staging_url?: string | null;
  stack?: WebsiteStack;
  status?: WebsiteStatus;
  client_org_id?: string | null;
  cms_admin_url?: string | null;
  vercel_project_id?: string | null;
  github_repo_url?: string | null;
  supabase_schema?: string | null;
  notes?: string | null;
  hosting_notes?: string | null;
  launched_at?: string | null;
  umami_website_id?: string | null;
  umami_share_url?: string | null;
  portal_visible?: boolean;
}) {
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
    ...(input.portal_visible !== undefined && {
      portal_visible: input.portal_visible,
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
      const businessIds = await this.listBusinessIdsForAccount(accountId);
      const { data } = await this.db
        .from('client_orgs')
        .select('name')
        .eq('id', row.client_org_id)
        .in('business_id', businessIds)
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
    if (!linkedClientId && row.job_id) {
      linkedClientId = await this.resolveClientIdFromJob(accountId, row.job_id);
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

  private async ensureCanEdit(accountId: string) {
    const user = await this.ensureUser();
    const { data, error } = await this.db
      .from('accounts_memberships')
      .select('account_role')
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) this.throwErr(error);
    const role = data?.account_role;
    if (role !== 'owner' && role !== 'admin' && role !== 'staff') {
      throw new Error('Permission denied');
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

  private async listWebsiteRows(
    input: ListWebsitesInput,
  ): Promise<WebsiteRow[]> {
    let query = this.db
      .from('websites')
      .select('*, client_orgs(name)')
      .eq('business_id', input.accountId)
      .order('name');

    if (input.status) {
      query = query.eq('status', input.status);
    }

    const clientFilter = await this.resolveClientWebsiteFilter(
      input.accountId,
      input.clientId,
    );
    if (clientFilter === 'none') return [];
    if (clientFilter) {
      query = query.or(clientFilter);
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

    if (clientFilter) {
      fallbackQuery = fallbackQuery.or(clientFilter);
    }

    const fallback = await fallbackQuery;
    if (fallback.error) {
      console.error('[websites] listWebsites error:', fallback.error.message);
      return [];
    }

    return (fallback.data ?? []) as WebsiteRow[];
  }

  private async resolveBusinessIdForAccount(
    accountId: string,
  ): Promise<string> {
    const { data: existing, error: lookupError } = await this.adminDb
      .from('businesses')
      .select('id')
      .eq('account_id', accountId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (existing?.id) return String(existing.id);

    const { data: account, error: accountError } = await this.adminDb
      .from('accounts')
      .select('id, name, slug')
      .eq('id', accountId)
      .maybeSingle();

    if (accountError) throw accountError;
    if (!account) throw new Error('Workspace not found');

    const accountRow = account as {
      name?: string | null;
      slug?: string | null;
    };
    const name =
      accountRow.name?.trim() || accountRow.slug?.trim() || 'Workspace';
    const slug =
      accountRow.slug?.trim() ||
      `workspace-${accountId.replace(/-/g, '').slice(0, 8)}`;

    const { data: created, error: createError } = await this.adminDb
      .from('businesses')
      .insert({
        name,
        slug,
        account_id: accountId,
        type: 'other',
      })
      .select('id')
      .single();

    if (createError || !created) {
      throw createError ?? new Error('Could not create business for workspace');
    }

    return String((created as { id: string }).id);
  }

  private async listBusinessIdsForAccount(
    accountId: string,
  ): Promise<string[]> {
    const { data, error } = await this.adminDb
      .from('businesses')
      .select('id')
      .eq('account_id', accountId);

    if (error) throw error;

    const ids = ((data ?? []) as Array<{ id: string }>).map((row) => row.id);
    if (ids.length > 0) return ids;

    return [await this.resolveBusinessIdForAccount(accountId)];
  }

  /**
   * Match websites by portal org **or** a delivery project already on this CRM
   * client (so a site linked to a project still appears before client_org_id is set).
   */
  private async resolveClientWebsiteFilter(
    accountId: string,
    clientId: string | undefined,
  ): Promise<string | 'none' | null> {
    if (!clientId) return null;

    const [{ data: clientRow }, { data: projects }] = await Promise.all([
      this.db
        .from('clients')
        .select('client_org_id')
        .eq('id', clientId)
        .eq('account_id', accountId)
        .maybeSingle(),
      this.db
        .from('projects')
        .select('id')
        .eq('client_id', clientId)
        .eq('account_id', accountId),
    ]);

    const orgId = (clientRow as { client_org_id?: string | null } | null)
      ?.client_org_id;
    const jobIds = ((projects ?? []) as Array<{ id: string }>).map(
      (row) => row.id,
    );

    const parts: string[] = [];
    if (orgId) parts.push(`client_org_id.eq.${orgId}`);
    if (jobIds.length > 0) {
      parts.push(`job_id.in.(${jobIds.join(',')})`);
    }

    if (parts.length === 0) return 'none';
    return parts.join(',');
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

  private async resolveClientIdFromJob(
    accountId: string,
    jobId: string,
  ): Promise<string | null> {
    const { data } = await this.db
      .from('projects')
      .select('client_id')
      .eq('id', jobId)
      .eq('account_id', accountId)
      .maybeSingle();

    return (data as { client_id?: string | null } | null)?.client_id ?? null;
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

    const jobIdsNeedingClient = [
      ...new Set(
        rows
          .filter((row) => !row.client_org_id && row.job_id)
          .map((row) => row.job_id as string),
      ),
    ];
    const jobClientIds = new Map<string, string>();
    if (jobIdsNeedingClient.length > 0) {
      const { data: projects } = await this.db
        .from('projects')
        .select('id, client_id')
        .eq('account_id', input.accountId)
        .in('id', jobIdsNeedingClient);
      for (const row of (projects ?? []) as Array<{
        id: string;
        client_id?: string | null;
      }>) {
        if (row.client_id) jobClientIds.set(row.id, row.client_id);
      }
    }

    return rows.map((row) =>
      mapWebsite(
        row,
        row.client_org_id
          ? (linkedClients.get(row.client_org_id) ?? null)
          : row.job_id
            ? (jobClientIds.get(row.job_id) ?? null)
            : null,
      ),
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
      return this.enrichWebsiteRow(
        input.accountId,
        fallback.data as WebsiteRow,
      );
    }

    if (!data) return null;

    return this.enrichWebsiteRow(input.accountId, data as WebsiteRow);
  }

  async listClientOrgs(accountId: string): Promise<ClientOrgOption[]> {
    await this.ensureCanView(accountId);

    const businessIds = await this.listBusinessIdsForAccount(accountId);
    const { data, error } = await this.db
      .from('client_orgs')
      .select('id, name')
      .in('business_id', businessIds)
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
    await this.ensureCanEdit(input.accountId);

    const {
      accountId,
      client_id: clientId,
      create_delivery_project: _createDelivery,
      existing_job_id: _existingJobId,
      ...fields
    } = input;

    let clientOrgId = fields.client_org_id ?? null;
    if (clientId) {
      const resolved = await this.resolveOrCreateClientOrgForCrmClient(
        accountId,
        clientId,
      );
      clientOrgId = resolved.clientOrgId;
    }

    return this.saveWebsiteRow(
      accountId,
      toDbPayload({ ...fields, client_org_id: clientOrgId }),
      'insert',
    );
  }

  async updateWebsite(
    accountId: string,
    input: UpdateWebsiteInput,
  ): Promise<Website> {
    await this.ensureCanEdit(accountId);

    const { websiteId, client_id: clientId, ...fields } = input;

    let clientOrgId = fields.client_org_id;
    if (clientId) {
      const resolved = await this.resolveOrCreateClientOrgForCrmClient(
        accountId,
        clientId,
      );
      clientOrgId = resolved.clientOrgId;
    } else if (clientId === null) {
      clientOrgId = null;
    }

    return this.saveWebsiteRow(
      accountId,
      toDbPayload({ ...fields, client_org_id: clientOrgId }),
      'update',
      websiteId,
    );
  }

  async deleteWebsite(accountId: string, websiteId: string): Promise<void> {
    await this.ensureCanEdit(accountId);

    const { error } = await this.adminDb
      .from('websites')
      .delete()
      .eq('id', websiteId)
      .eq('business_id', accountId);

    if (error) throw mapWebsiteWriteError(error);
  }

  async setPortalVisible(
    input: SetWebsitePortalVisibleInput,
  ): Promise<Website> {
    await this.ensureCanEdit(input.accountId);

    const current = await this.getWebsite({
      accountId: input.accountId,
      websiteId: input.websiteId,
    });
    if (!current) throw new Error('Website not found');

    if (input.portal_visible && !current.clientOrgId) {
      if (!current.linkedClientId) {
        throw new Error(
          'Link a CRM client before sharing this website to the portal.',
        );
      }
      return this.updateWebsite(input.accountId, {
        websiteId: input.websiteId,
        name: current.name,
        client_id: current.linkedClientId,
        portal_visible: true,
      });
    }

    return this.saveWebsiteRow(
      input.accountId,
      toDbPayload({ portal_visible: input.portal_visible }),
      'update',
      input.websiteId,
    );
  }

  /**
   * Resolve the portal `client_org` for a CRM client, creating an org when the
   * client is not yet linked. Reuses the same org→client bridge as
   * `resolveLinkedClientIds` / `createWebsiteProject`.
   */
  async resolveOrCreateClientOrgForCrmClient(
    accountId: string,
    clientId: string,
  ): Promise<{ clientOrgId: string; created: boolean }> {
    await this.ensureCanEdit(accountId);

    const { data: clientRow, error: clientError } = await this.db
      .from('clients')
      .select('id, client_org_id, display_name, company_name')
      .eq('id', clientId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (clientError) throw clientError;
    if (!clientRow) throw new Error('CRM client not found');

    const existingOrgId = (clientRow as { client_org_id?: string | null })
      .client_org_id;

    if (existingOrgId) {
      return { clientOrgId: existingOrgId, created: false };
    }

    const displayName =
      (clientRow as { company_name?: string | null }).company_name?.trim() ||
      (clientRow as { display_name?: string | null }).display_name?.trim() ||
      'Client';

    const slug = slugifyClientOrg(displayName);
    const businessId = await this.resolveBusinessIdForAccount(accountId);

    const { data: org, error: orgError } = await this.adminDb
      .from('client_orgs')
      .insert({
        business_id: businessId,
        name: displayName,
        slug,
        status: 'active',
      })
      .select('id')
      .single();

    if (orgError || !org) {
      throw orgError ?? new Error('Could not create client organisation');
    }

    const clientOrgId = String((org as { id: string }).id);

    const { error: linkError } = await this.adminDb
      .from('clients')
      .update({ client_org_id: clientOrgId })
      .eq('id', clientId)
      .eq('account_id', accountId);

    if (linkError) throw linkError;

    return { clientOrgId, created: true };
  }
}
