import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { composeCampaignContactName } from './campaign-contact-csv';
import type {
  CampaignContactCategory,
  CampaignWorkspaceContact,
} from './campaign.types';

function fromTable(client: SupabaseClient, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from(table);
}

function mapCategory(row: Record<string, unknown>): CampaignContactCategory {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    name: String(row.name),
    archivedAt: (row.archived_at as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapContact(
  row: Record<string, unknown>,
  categoryIds: string[] = [],
): CampaignWorkspaceContact {
  const names = composeCampaignContactName({
    firstName: (row.first_name as string | null) ?? null,
    lastName: (row.last_name as string | null) ?? null,
    fullName: (row.full_name as string | null) ?? null,
    email: (row.email as string | null) ?? null,
  });
  return {
    id: String(row.id),
    accountId: String(row.account_id ?? ''),
    email: (row.email as string | null) ?? null,
    firstName: names.firstName,
    lastName: names.lastName,
    fullName: names.fullName,
    phone: (row.phone as string | null) ?? null,
    companyName: (row.company_name as string | null) ?? null,
    createdAt: String(row.created_at ?? ''),
    categoryIds,
  };
}

export function createCampaignContactsService(client: SupabaseClient) {
  return new CampaignContactsService(client);
}

class CampaignContactsService {
  constructor(private readonly client: SupabaseClient) {}

  async listContacts(
    accountId: string,
    options?: {
      query?: string;
      categoryId?: string | null;
      limit?: number;
    },
  ): Promise<CampaignWorkspaceContact[]> {
    const limit = Math.min(Math.max(options?.limit ?? 500, 1), 2000);
    let scopedIds: string[] | null = null;
    if (options?.categoryId) {
      scopedIds = await this.listContactIdsInCategory(
        accountId,
        options.categoryId,
      );
      if (scopedIds.length === 0) return [];
    }

    let query = fromTable(this.client, 'contacts')
      .select(
        'id, account_id, email, first_name, last_name, full_name, phone, company_name, created_at',
      )
      .eq('account_id', accountId)
      .order('full_name', { ascending: true })
      .limit(limit);

    if (scopedIds) {
      query = query.in('id', scopedIds.slice(0, limit));
    }

    const search = options?.query?.trim();
    if (search) {
      const like = `%${search.replace(/[%_]/g, '')}%`;
      query = query.or(
        `email.ilike.${like},full_name.ilike.${like},first_name.ilike.${like},last_name.ilike.${like},company_name.ilike.${like},phone.ilike.${like}`,
      );
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const contacts = ((data ?? []) as Array<Record<string, unknown>>).map(
      (row) => mapContact(row),
    );
    if (contacts.length === 0) return [];

    const assignments = await this.listAssignments(
      accountId,
      contacts.map((contact) => contact.id),
    );
    const byContact = new Map<string, string[]>();
    for (const row of assignments) {
      const current = byContact.get(row.contactId) ?? [];
      current.push(row.categoryId);
      byContact.set(row.contactId, current);
    }

    return contacts.map((contact) => ({
      ...contact,
      categoryIds: byContact.get(contact.id) ?? [],
    }));
  }

  async getContact(
    accountId: string,
    contactId: string,
  ): Promise<CampaignWorkspaceContact | null> {
    const { data, error } = await fromTable(this.client, 'contacts')
      .select(
        'id, account_id, email, first_name, last_name, full_name, phone, company_name, created_at',
      )
      .eq('account_id', accountId)
      .eq('id', contactId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;
    const assignments = await this.listAssignments(accountId, [contactId]);
    return mapContact(
      data as Record<string, unknown>,
      assignments.map((row) => row.categoryId),
    );
  }

  async upsertByEmail(input: {
    accountId: string;
    userId: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    fullName?: string | null;
    phone?: string | null;
    companyName?: string | null;
    knownExisting?: CampaignWorkspaceContact | null;
  }): Promise<{ contact: CampaignWorkspaceContact; created: boolean }> {
    const email = input.email.trim().toLowerCase();
    const existing =
      input.knownExisting !== undefined
        ? input.knownExisting
        : await this.findByEmail(input.accountId, email);
    const names = composeCampaignContactName({
      firstName: input.firstName,
      lastName: input.lastName,
      fullName: input.fullName,
      email,
    });

    if (existing) {
      const patch: Record<string, unknown> = {
        first_name: names.firstName,
        last_name: names.lastName,
        full_name: names.fullName,
      };
      if (input.phone !== undefined) patch.phone = input.phone?.trim() || null;
      if (input.companyName !== undefined) {
        patch.company_name = input.companyName?.trim() || null;
      }
      const { data, error } = await fromTable(this.client, 'contacts')
        .update(patch)
        .eq('id', existing.id)
        .eq('account_id', input.accountId)
        .select(
          'id, account_id, email, first_name, last_name, full_name, phone, company_name, created_at',
        )
        .single();
      if (error || !data) {
        throw new Error(error?.message ?? 'Could not update contact');
      }
      await this.syncPrimaryEmail(input.accountId, existing.id, email);
      return {
        contact: mapContact(
          data as Record<string, unknown>,
          existing.categoryIds,
        ),
        created: false,
      };
    }

    const insertPayload: Record<string, unknown> = {
      account_id: input.accountId,
      user_id: input.userId,
      email,
      first_name: names.firstName,
      last_name: names.lastName,
      full_name: names.fullName,
      phone: input.phone?.trim() || null,
      company_name: input.companyName?.trim() || null,
    };

    const { data, error } = await fromTable(this.client, 'contacts')
      .insert(insertPayload)
      .select(
        'id, account_id, email, first_name, last_name, full_name, phone, company_name, created_at',
      )
      .single();

    if (error || !data) {
      if (error && /company_name/.test(error.message)) {
        delete insertPayload.company_name;
        const retry = await fromTable(this.client, 'contacts')
          .insert(insertPayload)
          .select(
            'id, account_id, email, first_name, last_name, full_name, phone, created_at',
          )
          .single();
        if (retry.error || !retry.data) {
          throw new Error(retry.error?.message ?? 'Could not create contact');
        }
        await this.syncPrimaryEmail(
          input.accountId,
          String((retry.data as { id: string }).id),
          email,
        );
        return {
          contact: mapContact(retry.data as Record<string, unknown>),
          created: true,
        };
      }
      throw new Error(error?.message ?? 'Could not create contact');
    }

    const contact = mapContact(data as Record<string, unknown>);
    await this.syncPrimaryEmail(input.accountId, contact.id, email);
    return { contact, created: true };
  }

  async importByEmail(
    accountId: string,
    userId: string,
    drafts: Array<{
      email: string;
      firstName?: string | null;
      lastName?: string | null;
      fullName?: string | null;
      phone?: string | null;
      companyName?: string | null;
    }>,
  ): Promise<{
    created: number;
    matched: number;
    contactIds: string[];
    failed: Array<{ email: string; error: string }>;
  }> {
    const existing = await this.findByEmails(
      accountId,
      drafts.map((draft) => draft.email),
    );
    let created = 0;
    let matched = 0;
    const contactIds: string[] = [];
    const failed: Array<{ email: string; error: string }> = [];

    for (const draft of drafts) {
      try {
        const result = await this.upsertByEmail({
          accountId,
          userId,
          email: draft.email,
          firstName: draft.firstName,
          lastName: draft.lastName,
          fullName: draft.fullName,
          phone: draft.phone,
          companyName: draft.companyName,
          knownExisting: existing.get(draft.email.trim().toLowerCase()) ?? null,
        });
        contactIds.push(result.contact.id);
        if (result.created) created += 1;
        else matched += 1;
      } catch (error) {
        failed.push({
          email: draft.email,
          error: error instanceof Error ? error.message : 'Could not save',
        });
      }
    }

    return { created, matched, contactIds, failed };
  }

  async saveContact(input: {
    accountId: string;
    userId: string;
    contactId?: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    fullName?: string | null;
    phone?: string | null;
    companyName?: string | null;
    categoryIds?: string[];
  }): Promise<CampaignWorkspaceContact> {
    const email = input.email.trim().toLowerCase();
    const names = composeCampaignContactName({
      firstName: input.firstName,
      lastName: input.lastName,
      fullName: input.fullName,
      email,
    });

    let contact: CampaignWorkspaceContact;

    if (input.contactId) {
      const { data, error } = await fromTable(this.client, 'contacts')
        .update({
          email,
          first_name: names.firstName,
          last_name: names.lastName,
          full_name: names.fullName,
          phone: input.phone?.trim() || null,
          company_name: input.companyName?.trim() || null,
        })
        .eq('id', input.contactId)
        .eq('account_id', input.accountId)
        .select(
          'id, account_id, email, first_name, last_name, full_name, phone, company_name, created_at',
        )
        .single();
      if (error || !data) {
        throw new Error(error?.message ?? 'Could not update contact');
      }
      contact = mapContact(data as Record<string, unknown>);
      await this.syncPrimaryEmail(input.accountId, contact.id, email);
    } else {
      const result = await this.upsertByEmail({
        accountId: input.accountId,
        userId: input.userId,
        email,
        firstName: names.firstName,
        lastName: names.lastName,
        fullName: names.fullName,
        phone: input.phone,
        companyName: input.companyName,
      });
      contact = result.contact;
    }

    if (input.categoryIds) {
      await this.setContactCategories({
        accountId: input.accountId,
        contactId: contact.id,
        categoryIds: input.categoryIds,
      });
      contact = { ...contact, categoryIds: input.categoryIds };
    }

    return contact;
  }

  async listCategories(
    accountId: string,
    options?: { includeArchived?: boolean },
  ): Promise<CampaignContactCategory[]> {
    let query = fromTable(this.client, 'campaign_contact_categories')
      .select('*')
      .eq('account_id', accountId)
      .order('name', { ascending: true });

    if (!options?.includeArchived) {
      query = query.is('archived_at', null);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<Record<string, unknown>>).map(mapCategory);
  }

  async saveCategory(input: {
    accountId: string;
    userId: string;
    categoryId?: string;
    name: string;
  }): Promise<CampaignContactCategory> {
    const name = input.name.trim();
    if (!name) throw new Error('Category name is required');

    if (input.categoryId) {
      const { data, error } = await fromTable(
        this.client,
        'campaign_contact_categories',
      )
        .update({ name, archived_at: null })
        .eq('account_id', input.accountId)
        .eq('id', input.categoryId)
        .select('*')
        .single();
      if (error || !data) {
        throw new Error(error?.message ?? 'Could not rename category');
      }
      return mapCategory(data as Record<string, unknown>);
    }

    const { data, error } = await fromTable(
      this.client,
      'campaign_contact_categories',
    )
      .insert({
        account_id: input.accountId,
        created_by: input.userId,
        name,
      })
      .select('*')
      .single();
    if (error || !data) {
      throw new Error(error?.message ?? 'Could not create category');
    }
    return mapCategory(data as Record<string, unknown>);
  }

  async archiveCategory(accountId: string, categoryId: string): Promise<void> {
    const { error } = await fromTable(
      this.client,
      'campaign_contact_categories',
    )
      .update({ archived_at: new Date().toISOString() })
      .eq('account_id', accountId)
      .eq('id', categoryId);
    if (error) throw new Error(error.message);
  }

  async setContactCategories(input: {
    accountId: string;
    contactId: string;
    categoryIds: string[];
  }): Promise<void> {
    const unique = [...new Set(input.categoryIds.filter(Boolean))];
    const { error: deleteError } = await fromTable(
      this.client,
      'campaign_contact_category_assignments',
    )
      .delete()
      .eq('account_id', input.accountId)
      .eq('contact_id', input.contactId);
    if (deleteError) throw new Error(deleteError.message);
    if (unique.length === 0) return;

    const { error } = await fromTable(
      this.client,
      'campaign_contact_category_assignments',
    ).insert(
      unique.map((categoryId) => ({
        account_id: input.accountId,
        contact_id: input.contactId,
        category_id: categoryId,
      })),
    );
    if (error) throw new Error(error.message);
  }

  async addCategoriesToContacts(input: {
    accountId: string;
    contactIds: string[];
    categoryIds: string[];
  }): Promise<number> {
    const contactIds = [...new Set(input.contactIds.filter(Boolean))];
    const categoryIds = [...new Set(input.categoryIds.filter(Boolean))];
    if (contactIds.length === 0 || categoryIds.length === 0) return 0;

    const rows = contactIds.flatMap((contactId) =>
      categoryIds.map((categoryId) => ({
        account_id: input.accountId,
        contact_id: contactId,
        category_id: categoryId,
      })),
    );

    const { error } = await fromTable(
      this.client,
      'campaign_contact_category_assignments',
    ).upsert(rows, {
      onConflict: 'contact_id,category_id',
      ignoreDuplicates: true,
    });
    if (error) throw new Error(error.message);
    return rows.length;
  }

  async listContactIdsInCategory(
    accountId: string,
    categoryId: string,
  ): Promise<string[]> {
    const { data, error } = await fromTable(
      this.client,
      'campaign_contact_category_assignments',
    )
      .select('contact_id')
      .eq('account_id', accountId)
      .eq('category_id', categoryId);

    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<{ contact_id: string }>).map(
      (row) => row.contact_id,
    );
  }

  async listAssignments(
    accountId: string,
    contactIds?: string[],
  ): Promise<Array<{ contactId: string; categoryId: string }>> {
    let query = fromTable(this.client, 'campaign_contact_category_assignments')
      .select('contact_id, category_id')
      .eq('account_id', accountId);

    if (contactIds && contactIds.length > 0) {
      query = query.in('contact_id', contactIds);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      contactId: String(row.contact_id),
      categoryId: String(row.category_id),
    }));
  }

  async findByEmail(
    accountId: string,
    email: string,
  ): Promise<CampaignWorkspaceContact | null> {
    const map = await this.findByEmails(accountId, [email]);
    return map.get(email.trim().toLowerCase()) ?? null;
  }

  async findByEmails(
    accountId: string,
    emails: string[],
  ): Promise<Map<string, CampaignWorkspaceContact>> {
    const result = new Map<string, CampaignWorkspaceContact>();
    const normalized = [
      ...new Set(
        emails.map((email) => email.trim().toLowerCase()).filter(Boolean),
      ),
    ];
    if (normalized.length === 0) return result;

    const { data, error } = await fromTable(this.client, 'contacts')
      .select(
        'id, account_id, email, first_name, last_name, full_name, phone, company_name, created_at',
      )
      .eq('account_id', accountId)
      .not('email', 'is', null)
      .limit(5000);

    if (error) throw new Error(error.message);

    const wanted = new Set(normalized);
    const byId = new Map<string, CampaignWorkspaceContact>();
    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      const contact = mapContact(row);
      byId.set(contact.id, contact);
      const email = contact.email?.trim().toLowerCase();
      if (email && wanted.has(email)) {
        result.set(email, contact);
      }
    }

    const missing = normalized.filter((email) => !result.has(email));
    if (missing.length === 0) return result;

    const { data: extras, error: extraError } = await fromTable(
      this.client,
      'contact_email_addresses',
    )
      .select('contact_id, email')
      .eq('account_id', accountId)
      .in('email', missing);

    if (extraError) {
      return result;
    }

    for (const row of (extras ?? []) as Array<{
      contact_id: string;
      email: string;
    }>) {
      const email = row.email.trim().toLowerCase();
      const existing = byId.get(row.contact_id);
      if (existing) {
        result.set(email, existing);
        continue;
      }
      const contact = await this.getContact(accountId, row.contact_id);
      if (contact) result.set(email, contact);
    }

    return result;
  }

  private async syncPrimaryEmail(
    accountId: string,
    contactId: string,
    email: string,
  ) {
    try {
      await this.client.rpc('replace_contact_email_addresses', {
        p_account_id: accountId,
        p_contact_id: contactId,
        p_addresses: [{ email, label: 'work', isPrimary: true }],
      });
    } catch {
      // Older schemas / missing RPC — contacts.email is enough for campaigns.
    }
  }
}
