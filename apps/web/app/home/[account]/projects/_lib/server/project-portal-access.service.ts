import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

import { composeContactFullName } from '~/lib/clients/contact-roles';
import {
  DELIVERY_PROJECT_FILTER,
  PROJECTS_TABLE,
} from '~/lib/projects/delivery-project-db';

import type {
  GetProjectPortalAccessInput,
  ProjectPortalAccess,
  ProjectPortalContactOption,
  SetProjectPortalAccessInput,
} from '../schema/project-portal-access.schema';

export function createProjectPortalAccessService(client: SupabaseClient) {
  return new ProjectPortalAccessService(client);
}

class ProjectPortalAccessService {
  constructor(private readonly client: SupabaseClient) {}

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
    if (accountId === user.id) return user;

    const api = createTeamAccountsApi(this.client);
    const hasPermission = await api.hasPermission({
      userId: user.id,
      accountId,
      permission: 'jobs.edit',
    });
    if (!hasPermission) throw new Error('Permission denied');
    return user;
  }

  private async loadProject(accountId: string, jobId: string) {
    const { data, error } = await this.client
      .from(PROJECTS_TABLE)
      .select('id, client_id, portal_visible, portal_restrict_contacts')
      .eq('id', jobId)
      .eq('account_id', accountId)
      .eq('project_type', DELIVERY_PROJECT_FILTER.project_type)
      .maybeSingle();

    if (error) this.throwErr(error);
    if (!data) throw new Error('Project not found');

    const row = data as {
      id: string;
      client_id?: string | null;
      portal_visible?: boolean | null;
      portal_restrict_contacts?: boolean | null;
    };

    return {
      id: row.id,
      clientId: row.client_id ?? null,
      portalVisible: Boolean(row.portal_visible),
      restrictContacts: Boolean(row.portal_restrict_contacts),
    };
  }

  private async listClientContacts(
    clientId: string,
  ): Promise<ProjectPortalContactOption[]> {
    const { data, error } = await this.client
      .from('client_contacts')
      .select(
        'role, is_primary, created_at, contacts ( id, full_name, first_name, last_name, email )',
      )
      .eq('client_id', clientId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) this.throwErr(error, 'Failed to load client contacts');

    return (
      (data ?? []) as Array<{
        role?: string | null;
        is_primary?: boolean | null;
        contacts?: {
          id?: string;
          full_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
        } | null;
      }>
    )
      .map((row) => {
        const contact = row.contacts;
        if (!contact?.id) return null;
        const fullName =
          composeContactFullName({
            firstName: contact.first_name,
            lastName: contact.last_name,
            fullName: contact.full_name,
          }) ||
          contact.full_name?.trim() ||
          contact.email?.trim() ||
          'Contact';

        return {
          id: contact.id,
          fullName,
          email: contact.email?.trim() || null,
          role: row.role?.trim() || null,
          isPrimary: Boolean(row.is_primary),
        };
      })
      .filter((row): row is ProjectPortalContactOption => Boolean(row));
  }

  private async listAllowlistedContactIds(jobId: string) {
    const { data, error } = await this.client
      .from('project_portal_contacts')
      .select('contact_id')
      .eq('project_id', jobId);

    if (error) this.throwErr(error, 'Failed to load portal contact access');

    return [
      ...new Set(
        ((data ?? []) as Array<{ contact_id: string }>).map(
          (row) => row.contact_id,
        ),
      ),
    ];
  }

  async getAccess(
    input: GetProjectPortalAccessInput,
  ): Promise<ProjectPortalAccess> {
    await this.ensureUser();
    const project = await this.loadProject(input.accountId, input.jobId);
    const contacts = project.clientId
      ? await this.listClientContacts(project.clientId)
      : [];
    const contactIds = project.clientId
      ? await this.listAllowlistedContactIds(input.jobId)
      : [];

    const allowed = new Set(contacts.map((contact) => contact.id));

    return {
      jobId: project.id,
      clientId: project.clientId,
      portalVisible: project.portalVisible,
      restrictContacts: project.restrictContacts,
      contactIds: contactIds.filter((id) => allowed.has(id)),
      contacts,
    };
  }

  async setAccess(
    input: SetProjectPortalAccessInput,
  ): Promise<ProjectPortalAccess> {
    await this.ensureCanEdit(input.accountId);
    const project = await this.loadProject(input.accountId, input.jobId);

    const nextVisible =
      input.portalVisible !== undefined
        ? input.portalVisible
        : project.portalVisible;
    const nextRestrict =
      input.restrictContacts !== undefined
        ? input.restrictContacts
        : project.restrictContacts;

    if (nextVisible && !project.clientId) {
      throw new Error(
        'Link a client to this project before enabling portal access',
      );
    }

    if (input.restrictContacts === true && !nextVisible) {
      throw new Error(
        'Share the project to the client portal before restricting contacts',
      );
    }

    const payload: Record<string, unknown> = {};
    if (input.portalVisible !== undefined) {
      payload.portal_visible = nextVisible;
    }
    if (input.restrictContacts !== undefined) {
      payload.portal_restrict_contacts = nextRestrict;
    }

    if (Object.keys(payload).length > 0) {
      const { error } = await this.client
        .from(PROJECTS_TABLE)
        .update(payload)
        .eq('id', input.jobId)
        .eq('account_id', input.accountId)
        .eq('project_type', DELIVERY_PROJECT_FILTER.project_type);

      if (error) this.throwErr(error, 'Could not update portal access');
    }

    if (input.contactIds !== undefined) {
      if (!project.clientId) {
        throw new Error(
          'Link a client to this project before assigning portal contacts',
        );
      }

      const contacts = await this.listClientContacts(project.clientId);
      const allowed = new Set(contacts.map((contact) => contact.id));
      const nextIds = [...new Set(input.contactIds)];
      const invalid = nextIds.filter((id) => !allowed.has(id));
      if (invalid.length > 0) {
        throw new Error(
          'Only contacts for this project’s client can be granted access',
        );
      }

      const currentIds = await this.listAllowlistedContactIds(input.jobId);
      const nextSet = new Set(nextIds);
      const currentSet = new Set(currentIds);
      const toInsert = nextIds.filter((id) => !currentSet.has(id));
      const toDelete = currentIds.filter((id) => !nextSet.has(id));

      if (toDelete.length > 0) {
        const { error } = await this.client
          .from('project_portal_contacts')
          .delete()
          .eq('project_id', input.jobId)
          .in('contact_id', toDelete);
        if (error) this.throwErr(error, 'Could not update portal contacts');
      }

      if (toInsert.length > 0) {
        const { error } = await this.client
          .from('project_portal_contacts')
          .insert(
            toInsert.map((contactId) => ({
              project_id: input.jobId,
              contact_id: contactId,
            })),
          );
        if (error) this.throwErr(error, 'Could not update portal contacts');
      }
    }

    return this.getAccess({
      accountId: input.accountId,
      jobId: input.jobId,
    });
  }
}
