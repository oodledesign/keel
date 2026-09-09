import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  type AudienceListFilters,
  parseAudienceListFilters,
} from './campaign-audience-filters';
import type {
  CampaignAudienceList,
  CampaignAudienceListMember,
} from './campaign.types';

function fromTable(client: SupabaseClient, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from(table);
}

function mapList(
  row: Record<string, unknown>,
  memberCount = 0,
): CampaignAudienceList {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    createdBy: (row.created_by as string | null) ?? null,
    name: String(row.name),
    source: (row.source as CampaignAudienceList['source']) ?? 'subscribers',
    matchMode: (row.match_mode as CampaignAudienceList['matchMode']) ?? 'all',
    filters: row.filters ?? [],
    memberCount,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function contactDisplayName(row: Record<string, unknown>): string {
  const full = String(row.full_name ?? '').trim();
  if (full) return full;
  const joined = [row.first_name, row.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (joined) return joined;
  return String(row.email ?? '').trim() || 'Unnamed contact';
}

export function createAudienceListsService(client: SupabaseClient) {
  return new AudienceListsService(client);
}

class AudienceListsService {
  constructor(private readonly client: SupabaseClient) {}

  async list(accountId: string): Promise<CampaignAudienceList[]> {
    const { data, error } = await fromTable(
      this.client,
      'campaign_audience_lists',
    )
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    const lists = ((data ?? []) as Array<Record<string, unknown>>).map((row) =>
      mapList(row),
    );

    const manualIds = lists
      .filter((list) => list.source === 'manual')
      .map((list) => list.id);
    if (manualIds.length === 0) return lists;

    const { data: members, error: membersError } = await fromTable(
      this.client,
      'campaign_audience_list_members',
    )
      .select('list_id')
      .eq('account_id', accountId)
      .in('list_id', manualIds);

    if (membersError) throw new Error(membersError.message);

    const counts = new Map<string, number>();
    for (const row of (members ?? []) as Array<{ list_id: string }>) {
      counts.set(row.list_id, (counts.get(row.list_id) ?? 0) + 1);
    }

    return lists.map((list) =>
      list.source === 'manual'
        ? { ...list, memberCount: counts.get(list.id) ?? 0 }
        : list,
    );
  }

  async get(
    accountId: string,
    listId: string,
  ): Promise<CampaignAudienceList | null> {
    const { data, error } = await fromTable(
      this.client,
      'campaign_audience_lists',
    )
      .select('*')
      .eq('account_id', accountId)
      .eq('id', listId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;
    return mapList(data as Record<string, unknown>);
  }

  async create(input: {
    accountId: string;
    userId: string;
    name: string;
    filters: AudienceListFilters;
    contactIds?: string[];
  }): Promise<CampaignAudienceList> {
    const filters = parseAudienceListFilters(input.filters);
    const { data, error } = await fromTable(
      this.client,
      'campaign_audience_lists',
    )
      .insert({
        account_id: input.accountId,
        created_by: input.userId,
        name: input.name.trim(),
        source: filters.source,
        match_mode: filters.matchMode,
        filters: filters.source === 'manual' ? [] : filters.rules,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Could not save audience list');
    }

    const list = mapList(data as Record<string, unknown>);
    if (filters.source === 'manual' && (input.contactIds ?? []).length > 0) {
      await this.addMembers({
        accountId: input.accountId,
        listId: list.id,
        contactIds: input.contactIds ?? [],
      });
      list.memberCount = input.contactIds?.length ?? 0;
    }
    return list;
  }

  async update(input: {
    accountId: string;
    listId: string;
    name?: string;
    filters?: AudienceListFilters;
  }): Promise<CampaignAudienceList> {
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.filters !== undefined) {
      const filters = parseAudienceListFilters(input.filters);
      patch.source = filters.source;
      patch.match_mode = filters.matchMode;
      patch.filters = filters.source === 'manual' ? [] : filters.rules;
    }

    const { data, error } = await fromTable(
      this.client,
      'campaign_audience_lists',
    )
      .update(patch)
      .eq('account_id', input.accountId)
      .eq('id', input.listId)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Could not update audience list');
    }
    return mapList(data as Record<string, unknown>);
  }

  async delete(accountId: string, listId: string): Promise<void> {
    const { data: inUse, error: inUseError } = await fromTable(
      this.client,
      'workspace_email_campaigns',
    )
      .select('id')
      .eq('account_id', accountId)
      .eq('audience_type', 'list')
      .contains('audience_config', { listId })
      .limit(1);

    if (inUseError) throw new Error(inUseError.message);
    if (inUse?.length) {
      throw new Error(
        'This list is used by a campaign. Change that campaign’s audience first.',
      );
    }

    const { error } = await fromTable(this.client, 'campaign_audience_lists')
      .delete()
      .eq('account_id', accountId)
      .eq('id', listId);
    if (error) throw new Error(error.message);
  }

  async listMembers(
    accountId: string,
    listId: string,
  ): Promise<CampaignAudienceListMember[]> {
    const { data, error } = await fromTable(
      this.client,
      'campaign_audience_list_members',
    )
      .select(
        'id, list_id, contact_id, created_at, contacts ( id, email, full_name, first_name, last_name )',
      )
      .eq('account_id', accountId)
      .eq('list_id', listId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
      const contact = (row.contacts ?? {}) as Record<string, unknown>;
      return {
        id: String(row.id),
        listId: String(row.list_id),
        contactId: String(row.contact_id),
        email: (contact.email as string | null) ?? null,
        displayName: contactDisplayName(contact),
        createdAt: String(row.created_at),
      };
    });
  }

  async addMembers(input: {
    accountId: string;
    listId: string;
    contactIds: string[];
  }): Promise<number> {
    const list = await this.requireManualList(input.accountId, input.listId);
    const unique = [...new Set(input.contactIds.filter(Boolean))];
    if (unique.length === 0) return 0;

    const { data: contacts, error: contactError } = await fromTable(
      this.client,
      'contacts',
    )
      .select('id')
      .eq('account_id', input.accountId)
      .in('id', unique);

    if (contactError) throw new Error(contactError.message);
    const allowed = new Set(
      ((contacts ?? []) as Array<{ id: string }>).map((row) => row.id),
    );
    const rows = unique
      .filter((id) => allowed.has(id))
      .map((contactId) => ({
        account_id: input.accountId,
        list_id: list.id,
        contact_id: contactId,
      }));

    if (rows.length === 0) return 0;

    const { error } = await fromTable(
      this.client,
      'campaign_audience_list_members',
    ).upsert(rows, {
      onConflict: 'list_id,contact_id',
      ignoreDuplicates: true,
    });

    if (error) throw new Error(error.message);
    return rows.length;
  }

  async removeMembers(input: {
    accountId: string;
    listId: string;
    contactIds: string[];
  }): Promise<void> {
    await this.requireManualList(input.accountId, input.listId);
    const unique = [...new Set(input.contactIds.filter(Boolean))];
    if (unique.length === 0) return;

    const { error } = await fromTable(
      this.client,
      'campaign_audience_list_members',
    )
      .delete()
      .eq('account_id', input.accountId)
      .eq('list_id', input.listId)
      .in('contact_id', unique);

    if (error) throw new Error(error.message);
  }

  async replaceMembers(input: {
    accountId: string;
    listId: string;
    contactIds: string[];
  }): Promise<number> {
    await this.requireManualList(input.accountId, input.listId);
    const { error } = await fromTable(
      this.client,
      'campaign_audience_list_members',
    )
      .delete()
      .eq('account_id', input.accountId)
      .eq('list_id', input.listId);
    if (error) throw new Error(error.message);
    return this.addMembers(input);
  }

  private async requireManualList(accountId: string, listId: string) {
    const list = await this.get(accountId, listId);
    if (!list) throw new Error('Audience list not found');
    if (list.source !== 'manual') {
      throw new Error('Only manual lists have static members');
    }
    return list;
  }
}
