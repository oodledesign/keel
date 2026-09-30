import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';

import type { Database } from '~/lib/database.types';
import { looseClient } from '~/lib/retainers/loose-client';

import type {
  AddProjectContactInput,
  AddProjectMemberInput,
  CreateProjectContactInput,
  ProjectContactCandidate,
  RemoveProjectContactInput,
  RemoveProjectMemberInput,
  SearchProjectContactsInput,
  UpdateProjectContactInput,
  UpdateProjectMemberInput,
} from '../schema/project-team.schema';

const UNIQUE_VIOLATION = '23505';
const CANDIDATE_LIMIT = 30;

type ContactRow = {
  id: string;
  full_name: string;
  email: string | null;
  company_name: string | null;
  picture_url: string | null;
};

export function createProjectTeamService(client: SupabaseClient<Database>) {
  return new ProjectTeamService(client);
}

class ProjectTeamService {
  constructor(private readonly client: SupabaseClient<Database>) {}

  private get loose() {
    return looseClient(this.client);
  }

  /** Signed in, allowed to edit projects, and the project is in the account. */
  private async requireEditableProject(accountId: string, jobId: string) {
    const { data: user, error: userError } = await requireUser(this.client);
    if (userError || !user) throw new Error('Authentication required');

    const { data: canEdit, error } = await this.loose.rpc(
      'can_edit_project_canvas',
      { p_account_id: accountId },
    );
    if (error) throw new Error(error.message);
    if (canEdit !== true) throw new Error('Permission denied');

    return this.projectClientId(accountId, jobId);
  }

  private async projectClientId(accountId: string, jobId: string) {
    const { data, error } = await this.client
      .from('projects')
      .select('id, client_id')
      .eq('id', jobId)
      .eq('account_id', accountId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Project not found');
    return (data as { client_id: string | null }).client_id;
  }

  async addMember(input: AddProjectMemberInput) {
    await this.requireEditableProject(input.accountId, input.jobId);

    const { data: membership, error: memberError } = await this.client
      .from('accounts_memberships')
      .select('user_id')
      .eq('account_id', input.accountId)
      .eq('user_id', input.userId)
      .maybeSingle();
    if (memberError) throw new Error(memberError.message);
    if (!membership) throw new Error('That person is not in this workspace');

    const { error } = await this.loose.from('project_assignments').insert({
      account_id: input.accountId,
      project_id: input.jobId,
      user_id: input.userId,
      role_on_project: input.role ?? null,
      description: input.description ?? null,
    });
    if (error?.code === UNIQUE_VIOLATION) {
      throw new Error('Already on the project team');
    }
    if (error) throw new Error(error.message);
  }

  async updateMember(input: UpdateProjectMemberInput) {
    await this.requireEditableProject(input.accountId, input.jobId);
    const { data, error } = await this.loose
      .from('project_assignments')
      .update({ role_on_project: input.role, description: input.description })
      .eq('project_id', input.jobId)
      .eq('user_id', input.userId)
      .select('user_id');
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error('Not on the project team');
  }

  async removeMember(input: RemoveProjectMemberInput) {
    await this.requireEditableProject(input.accountId, input.jobId);
    const { error } = await this.client
      .from('project_assignments')
      .delete()
      .eq('project_id', input.jobId)
      .eq('user_id', input.userId);
    if (error) throw new Error(error.message);
  }

  async addContact(input: AddProjectContactInput) {
    await this.requireEditableProject(input.accountId, input.jobId);
    await this.insertProjectContact(input);
  }

  private async insertProjectContact(input: AddProjectContactInput) {
    const { error } = await this.loose.from('project_contacts').insert({
      account_id: input.accountId,
      project_id: input.jobId,
      contact_id: input.contactId,
      role: input.role ?? null,
      description: input.description ?? null,
    });
    if (error?.code === UNIQUE_VIOLATION) {
      throw new Error('Already on the project');
    }
    if (error) throw new Error(error.message);
  }

  async createContact(input: CreateProjectContactInput) {
    const clientId = await this.requireEditableProject(
      input.accountId,
      input.jobId,
    );

    const { data: contact, error } = await this.client
      .from('contacts')
      .insert({
        account_id: input.accountId,
        full_name: input.name,
        email: input.email ?? null,
        company_name: input.companyName ?? null,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);

    if (input.linkToClient && clientId) {
      const { error: linkError } = await this.client
        .from('client_contacts')
        .insert({
          client_id: clientId,
          contact_id: contact.id,
          role: input.role ?? null,
        });
      if (linkError) throw new Error(linkError.message);
    }

    await this.insertProjectContact({
      accountId: input.accountId,
      accountSlug: input.accountSlug,
      jobId: input.jobId,
      contactId: contact.id,
      role: input.role,
      description: input.description,
    });
    return { contactId: contact.id };
  }

  async updateContact(input: UpdateProjectContactInput) {
    await this.requireEditableProject(input.accountId, input.jobId);
    const { data, error } = await this.loose
      .from('project_contacts')
      .update({ role: input.role, description: input.description })
      .eq('project_id', input.jobId)
      .eq('contact_id', input.contactId)
      .select('id');
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error('Not on the project');
  }

  async removeContact(input: RemoveProjectContactInput) {
    await this.requireEditableProject(input.accountId, input.jobId);
    const { error } = await this.loose
      .from('project_contacts')
      .delete()
      .eq('project_id', input.jobId)
      .eq('contact_id', input.contactId);
    if (error) throw new Error(error.message);
  }

  /** Client contacts first, then other workspace contacts not yet on the project. */
  async searchContacts(
    input: SearchProjectContactsInput,
  ): Promise<ProjectContactCandidate[]> {
    const { data: user, error: userError } = await requireUser(this.client);
    if (userError || !user) throw new Error('Authentication required');
    const clientId = await this.projectClientId(input.accountId, input.jobId);

    const [clientLinks, onProject] = await Promise.all([
      clientId
        ? this.client
            .from('client_contacts')
            .select('contact_id')
            .eq('client_id', clientId)
        : Promise.resolve({ data: [], error: null }),
      this.loose
        .from('project_contacts')
        .select('contact_id')
        .eq('project_id', input.jobId),
    ]);
    if (clientLinks.error) throw new Error(clientLinks.error.message);
    if (onProject.error) throw new Error(onProject.error.message);

    const clientContactIds = new Set(
      (clientLinks.data ?? []).map((row) => row.contact_id as string),
    );
    const taken = new Set(
      (onProject.data ?? []).map((row) => row.contact_id as string),
    );

    let query = this.client
      .from('contacts')
      .select('id, full_name, email, company_name, picture_url')
      .eq('account_id', input.accountId)
      .order('full_name', { ascending: true })
      .limit(CANDIDATE_LIMIT * 2);
    const term = input.query.replace(/[%,()*\\"':]/g, ' ').trim();
    if (term) {
      query = query.or(
        `full_name.ilike.%${term}%,email.ilike.%${term}%,company_name.ilike.%${term}%`,
      );
    }

    const [matches, clientRows] = await Promise.all([
      query,
      !term && clientContactIds.size > 0
        ? this.client
            .from('contacts')
            .select('id, full_name, email, company_name, picture_url')
            .in('id', [...clientContactIds])
        : Promise.resolve({ data: [] as ContactRow[], error: null }),
    ]);
    if (matches.error) throw new Error(matches.error.message);
    if (clientRows.error) throw new Error(clientRows.error.message);

    const byId = new Map<string, ContactRow>();
    for (const row of [
      ...((clientRows.data ?? []) as ContactRow[]),
      ...((matches.data ?? []) as ContactRow[]),
    ]) {
      if (!taken.has(row.id)) byId.set(row.id, row);
    }

    return [...byId.values()]
      .map((row) => ({
        id: row.id,
        name: row.full_name,
        email: row.email,
        companyName: row.company_name,
        pictureUrl: row.picture_url,
        isClientContact: clientContactIds.has(row.id),
      }))
      .sort(
        (a, b) =>
          Number(b.isClientContact) - Number(a.isClientContact) ||
          a.name.localeCompare(b.name),
      )
      .slice(0, CANDIDATE_LIMIT);
  }
}
