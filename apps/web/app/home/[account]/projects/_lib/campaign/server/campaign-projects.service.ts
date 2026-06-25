import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';
import { createTeamAccountsApi } from '@kit/team-accounts/api';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import type { Database } from '~/lib/database.types';
import {
  normalizeFieldValue,
  slugifyFieldKey,
  type CampaignProject,
  type CampaignProjectDetail,
  type ProjectFieldDefinition,
  type ProjectFieldType,
  type ProjectFieldValue,
} from '~/lib/campaign-projects/types';
import {
  WEBSITE_REVAMP_CAMPAIGN_FIELDS,
  WEBSITE_REVAMP_CAMPAIGN_NAME,
  WEBSITE_REVAMP_IMPORT_CLIENTS,
} from '~/lib/campaign-projects/website-revamp-template';

import type {
  AddClientToCampaignInput,
  CreateCampaignProjectInput,
  CreateProjectFieldInput,
  DeleteCampaignProjectInput,
  DeleteProjectFieldInput,
  GetCampaignProjectInput,
  ListCampaignProjectsInput,
  RemoveClientFromCampaignInput,
  ReorderProjectFieldsInput,
  UpdateClientFieldValueInput,
  UpdateProjectFieldInput,
} from '../schema/campaign-projects.schema';

type FieldRow = {
  id: string;
  account_id: string;
  project_id: string;
  field_key: string;
  label: string;
  field_type: string;
  options: unknown;
  sort_order: number;
};

type ValueRow = {
  client_id: string;
  values: unknown;
};

function mapField(row: FieldRow): ProjectFieldDefinition {
  const options =
    row.options && typeof row.options === 'object' && !Array.isArray(row.options)
      ? (row.options as { choices?: string[] })
      : {};
  return {
    id: row.id,
    accountId: row.account_id,
    projectId: row.project_id,
    fieldKey: row.field_key,
    label: row.label,
    fieldType: row.field_type as ProjectFieldType,
    options,
    sortOrder: row.sort_order,
  };
}

function parseStoredValues(
  raw: unknown,
  fields: ProjectFieldDefinition[],
): Record<string, ProjectFieldValue> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const byId = Object.fromEntries(fields.map((field) => [field.id, field]));
  const result: Record<string, ProjectFieldValue> = {};

  for (const [fieldId, value] of Object.entries(raw as Record<string, unknown>)) {
    const field = byId[fieldId];
    if (!field) continue;
    result[fieldId] = normalizeFieldValue(field.fieldType, value);
  }

  return result;
}

export function createCampaignProjectsService(client: SupabaseClient<Database>) {
  return new CampaignProjectsService(client);
}

class CampaignProjectsService {
  constructor(private readonly client: SupabaseClient<Database>) {}

  private get db(): any {
    return this.client;
  }

  private get adminDb(): any {
    return getSupabaseServerAdminClient();
  }

  private async ensureUser() {
    const { data: user } = await requireUser(this.client);
    if (!user) throw new Error('Authentication required');
    return user;
  }

  private async ensurePermission(accountId: string) {
    const user = await this.ensureUser();
    const api = createTeamAccountsApi(this.client);
    const hasPermission = await api.hasPermission({
      userId: user.id,
      accountId,
      permission: 'jobs.edit',
    });
    if (!hasPermission) throw new Error('Permission denied');
    return user;
  }

  private throwErr(err: unknown, fallback = 'Something went wrong'): never {
    if (err instanceof Error) throw err;
    const msg =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : fallback;
    throw new Error(msg);
  }

  async listProjects(params: ListCampaignProjectsInput): Promise<CampaignProject[]> {
    await this.ensureUser();

    const { data: projects, error } = await this.db
      .from('projects')
      .select('id, account_id, name, created_at, updated_at')
      .eq('account_id', params.accountId)
      .eq('project_type', 'campaign')
      .order('updated_at', { ascending: false });

    if (error) this.throwErr(error);

    const ids = (projects ?? []).map((row: { id: string }) => row.id);
    const counts = new Map<string, number>();

    if (ids.length > 0) {
      const { data: clients, error: clientsError } = await this.db
        .from('clients')
        .select('project_id')
        .eq('account_id', params.accountId)
        .in('project_id', ids);

      if (clientsError) this.throwErr(clientsError);

      for (const row of clients ?? []) {
        const projectId = row.project_id as string;
        counts.set(projectId, (counts.get(projectId) ?? 0) + 1);
      }
    }

    return (projects ?? []).map(
      (row: {
        id: string;
        account_id: string;
        name: string;
        created_at: string;
        updated_at: string;
      }) => ({
        id: row.id,
        accountId: row.account_id,
        name: row.name,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        clientCount: counts.get(row.id) ?? 0,
      }),
    );
  }

  async getProject(params: GetCampaignProjectInput): Promise<CampaignProjectDetail> {
    await this.ensureUser();

    const { data: project, error } = await this.db
      .from('projects')
      .select('id, account_id, name, created_at, updated_at')
      .eq('account_id', params.accountId)
      .eq('id', params.projectId)
      .eq('project_type', 'campaign')
      .maybeSingle();

    if (error) this.throwErr(error);
    if (!project) throw new Error('Campaign project not found');

    const [fieldsResult, clientsResult, valuesResult] = await Promise.all([
      this.db
        .from('project_field_definitions')
        .select('*')
        .eq('project_id', params.projectId)
        .order('sort_order', { ascending: true }),
      this.db
        .from('clients')
        .select('id, display_name, company_name, email')
        .eq('account_id', params.accountId)
        .eq('project_id', params.projectId)
        .order('display_name', { ascending: true }),
      this.db
        .from('project_client_field_values')
        .select('client_id, values')
        .eq('project_id', params.projectId),
    ]);

    if (fieldsResult.error) this.throwErr(fieldsResult.error);
    if (clientsResult.error) this.throwErr(clientsResult.error);
    if (valuesResult.error) this.throwErr(valuesResult.error);

    const fields = ((fieldsResult.data ?? []) as FieldRow[]).map(mapField);
    const valuesByClient = new Map<string, Record<string, ProjectFieldValue>>();

    for (const row of (valuesResult.data ?? []) as ValueRow[]) {
      valuesByClient.set(row.client_id, parseStoredValues(row.values, fields));
    }

    const websiteUrlField = fields.find((field) => field.fieldKey === 'website_url');

    const rows = (clientsResult.data ?? []).map(
      (client: {
        id: string;
        display_name: string | null;
        company_name: string | null;
        email: string | null;
      }) => {
        const values = { ...(valuesByClient.get(client.id) ?? {}) };
        return {
          clientId: client.id,
          displayName: client.display_name?.trim() || 'Unnamed client',
          companyName: client.company_name,
          email: client.email,
          websiteUrl:
            websiteUrlField && values[websiteUrlField.id]
              ? String(values[websiteUrlField.id])
              : null,
          values,
        };
      },
    );

    return {
      id: project.id,
      accountId: project.account_id,
      name: project.name,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      clientCount: rows.length,
      fields,
      rows,
    };
  }

  async createProject(input: CreateCampaignProjectInput): Promise<CampaignProjectDetail> {
    await this.ensurePermission(input.accountId);

    const { data: project, error } = await this.adminDb
      .from('projects')
      .insert({
        account_id: input.accountId,
        name: input.name.trim(),
        project_type: 'campaign',
      })
      .select('id, account_id, name, created_at, updated_at')
      .single();

    if (error) this.throwErr(error);

    if (input.template === 'website_revamp') {
      await this.seedWebsiteRevampFields(input.accountId, project.id);
    }

    return this.getProject({
      accountId: input.accountId,
      projectId: project.id,
    });
  }

  async deleteProject(input: DeleteCampaignProjectInput): Promise<void> {
    await this.ensurePermission(input.accountId);

    await this.adminDb
      .from('clients')
      .update({ project_id: null })
      .eq('account_id', input.accountId)
      .eq('project_id', input.projectId);

    const { error } = await this.adminDb
      .from('projects')
      .delete()
      .eq('account_id', input.accountId)
      .eq('id', input.projectId)
      .eq('project_type', 'campaign');

    if (error) this.throwErr(error);
  }

  async createField(input: CreateProjectFieldInput): Promise<ProjectFieldDefinition> {
    await this.ensurePermission(input.accountId);

    const existing = await this.db
      .from('project_field_definitions')
      .select('sort_order')
      .eq('project_id', input.projectId)
      .order('sort_order', { ascending: false })
      .limit(1);

    const nextSort = ((existing.data?.[0]?.sort_order as number | undefined) ?? -1) + 1;
    let fieldKey = input.fieldKey ?? slugifyFieldKey(input.label);

    const { data: taken } = await this.db
      .from('project_field_definitions')
      .select('field_key')
      .eq('project_id', input.projectId)
      .like('field_key', `${fieldKey}%`);

    const keys = new Set(
      ((taken ?? []) as Array<{ field_key: string }>).map((row) => row.field_key),
    );
    if (keys.has(fieldKey)) {
      let suffix = 2;
      while (keys.has(`${fieldKey}_${suffix}`)) suffix += 1;
      fieldKey = `${fieldKey}_${suffix}`;
    }

    const { data, error } = await this.adminDb
      .from('project_field_definitions')
      .insert({
        account_id: input.accountId,
        project_id: input.projectId,
        field_key: fieldKey,
        label: input.label.trim(),
        field_type: input.fieldType,
        options: input.options ?? {},
        sort_order: nextSort,
      })
      .select('*')
      .single();

    if (error) this.throwErr(error);
    return mapField(data as FieldRow);
  }

  async updateField(input: UpdateProjectFieldInput): Promise<ProjectFieldDefinition> {
    await this.ensurePermission(input.accountId);

    const payload: Record<string, unknown> = {};
    if (input.label !== undefined) payload.label = input.label.trim();
    if (input.options !== undefined) payload.options = input.options;

    const { data, error } = await this.adminDb
      .from('project_field_definitions')
      .update(payload)
      .eq('account_id', input.accountId)
      .eq('project_id', input.projectId)
      .eq('id', input.fieldId)
      .select('*')
      .single();

    if (error) this.throwErr(error);
    return mapField(data as FieldRow);
  }

  async deleteField(input: DeleteProjectFieldInput): Promise<void> {
    await this.ensurePermission(input.accountId);

    const { error } = await this.adminDb
      .from('project_field_definitions')
      .delete()
      .eq('account_id', input.accountId)
      .eq('project_id', input.projectId)
      .eq('id', input.fieldId);

    if (error) this.throwErr(error);
  }

  async reorderFields(input: ReorderProjectFieldsInput): Promise<ProjectFieldDefinition[]> {
    await this.ensurePermission(input.accountId);

    await Promise.all(
      input.fieldIds.map((fieldId, index) =>
        this.adminDb
          .from('project_field_definitions')
          .update({ sort_order: index })
          .eq('account_id', input.accountId)
          .eq('project_id', input.projectId)
          .eq('id', fieldId),
      ),
    );

    const { data, error } = await this.db
      .from('project_field_definitions')
      .select('*')
      .eq('project_id', input.projectId)
      .order('sort_order', { ascending: true });

    if (error) this.throwErr(error);
    return ((data ?? []) as FieldRow[]).map(mapField);
  }

  async addClient(input: AddClientToCampaignInput): Promise<void> {
    await this.ensurePermission(input.accountId);

    const { error } = await this.adminDb
      .from('clients')
      .update({ project_id: input.projectId })
      .eq('account_id', input.accountId)
      .eq('id', input.clientId);

    if (error) this.throwErr(error);

    await this.adminDb.from('project_client_field_values').upsert(
      {
        account_id: input.accountId,
        project_id: input.projectId,
        client_id: input.clientId,
        values: {},
      },
      { onConflict: 'project_id,client_id' },
    );
  }

  async removeClient(input: RemoveClientFromCampaignInput): Promise<void> {
    await this.ensurePermission(input.accountId);

    await this.adminDb
      .from('project_client_field_values')
      .delete()
      .eq('project_id', input.projectId)
      .eq('client_id', input.clientId);

    const { error } = await this.adminDb
      .from('clients')
      .update({ project_id: null })
      .eq('account_id', input.accountId)
      .eq('id', input.clientId)
      .eq('project_id', input.projectId);

    if (error) this.throwErr(error);
  }

  async updateClientFieldValue(input: UpdateClientFieldValueInput): Promise<void> {
    await this.ensurePermission(input.accountId);

    const { data: field, error: fieldError } = await this.db
      .from('project_field_definitions')
      .select('id, field_type')
      .eq('id', input.fieldId)
      .eq('project_id', input.projectId)
      .maybeSingle();

    if (fieldError) this.throwErr(fieldError);
    if (!field) throw new Error('Field not found');

    const normalized = normalizeFieldValue(
      field.field_type as ProjectFieldType,
      input.value,
    );

    const { data: existing, error: existingError } = await this.db
      .from('project_client_field_values')
      .select('values')
      .eq('project_id', input.projectId)
      .eq('client_id', input.clientId)
      .maybeSingle();

    if (existingError) this.throwErr(existingError);

    const nextValues = {
      ...((existing?.values as Record<string, unknown> | undefined) ?? {}),
      [input.fieldId]: normalized,
    };

    const { error } = await this.adminDb.from('project_client_field_values').upsert(
      {
        account_id: input.accountId,
        project_id: input.projectId,
        client_id: input.clientId,
        values: nextValues,
      },
      { onConflict: 'project_id,client_id' },
    );

    if (error) this.throwErr(error);
  }

  async importWebsiteRevampCampaign(accountId: string): Promise<CampaignProjectDetail> {
    await this.ensurePermission(accountId);

    const { data: existing } = await this.db
      .from('projects')
      .select('id')
      .eq('account_id', accountId)
      .eq('name', WEBSITE_REVAMP_CAMPAIGN_NAME)
      .maybeSingle();

    let projectId = existing?.id as string | undefined;

    if (!projectId) {
      const created = await this.createProject({
        accountId,
        name: WEBSITE_REVAMP_CAMPAIGN_NAME,
        template: 'website_revamp',
      });
      projectId = created.id;
    } else {
      await this.seedWebsiteRevampFields(accountId, projectId);
    }

    const detail = await this.getProject({ accountId, projectId });
    const websiteUrlField = detail.fields.find((field) => field.fieldKey === 'website_url');

    for (const row of WEBSITE_REVAMP_IMPORT_CLIENTS) {
      const { data: existingClient } = await this.db
        .from('clients')
        .select('id')
        .eq('account_id', accountId)
        .ilike('display_name', row.name)
        .maybeSingle();

      let clientId = existingClient?.id as string | undefined;

      if (!clientId) {
        const { data: createdClient, error } = await this.adminDb
          .from('clients')
          .insert({
            account_id: accountId,
            display_name: row.name,
            first_name: row.name.split(' ')[0] || row.name,
            last_name: row.name.split(' ').slice(1).join(' ') || null,
            client_type: 'business',
            company_name: row.name,
          })
          .select('id')
          .single();

        if (error) this.throwErr(error);
        clientId = createdClient.id;
      }

      if (!clientId) continue;

      await this.addClient({ accountId, projectId, clientId });

      if (websiteUrlField && row.websiteUrl) {
        await this.updateClientFieldValue({
          accountId,
          projectId,
          clientId,
          fieldId: websiteUrlField.id,
          value: row.websiteUrl,
        });
      }
    }

    return this.getProject({ accountId, projectId });
  }

  private async seedWebsiteRevampFields(accountId: string, projectId: string) {
    const { data: existing } = await this.db
      .from('project_field_definitions')
      .select('field_key')
      .eq('project_id', projectId);

    const existingKeys = new Set(
      ((existing ?? []) as Array<{ field_key: string }>).map((row) => row.field_key),
    );

    const toInsert = WEBSITE_REVAMP_CAMPAIGN_FIELDS.filter(
      (field) => !existingKeys.has(field.fieldKey),
    ).map((field, index) => ({
      account_id: accountId,
      project_id: projectId,
      field_key: field.fieldKey,
      label: field.label,
      field_type: field.fieldType,
      options: field.options ?? {},
      sort_order: index,
    }));

    if (toInsert.length > 0) {
      const { error } = await this.adminDb
        .from('project_field_definitions')
        .insert(toInsert);
      if (error) this.throwErr(error);
    }
  }

  async listLinkOptions(accountId: string) {
    await this.ensureUser();

    const [clientsResult, projectsResult] = await Promise.all([
      this.db
        .from('clients')
        .select('id, display_name, company_name')
        .eq('account_id', accountId)
        .order('display_name', { ascending: true })
        .limit(500),
      this.db
        .from('projects')
        .select('id, name')
        .eq('account_id', accountId)
        .order('name', { ascending: true })
        .limit(200),
    ]);

    if (clientsResult.error) this.throwErr(clientsResult.error);
    if (projectsResult.error) this.throwErr(projectsResult.error);

    return {
      clients: (clientsResult.data ?? []).map(
        (row: {
          id: string;
          display_name: string | null;
          company_name: string | null;
        }) => ({
          id: row.id,
          name:
            row.display_name?.trim() ||
            row.company_name?.trim() ||
            'Unnamed client',
        }),
      ),
      projects: (projectsResult.data ?? []).map(
        (row: { id: string; name: string }) => ({
          id: row.id,
          name: row.name,
        }),
      ),
    };
  }
}
