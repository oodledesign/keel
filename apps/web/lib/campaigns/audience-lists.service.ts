import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  type AudienceListFilters,
  parseAudienceListFilters,
} from './campaign-audience-filters';
import type { CampaignAudienceList } from './campaign.types';

function fromTable(client: SupabaseClient, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from(table);
}

function mapList(row: Record<string, unknown>): CampaignAudienceList {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    createdBy: (row.created_by as string | null) ?? null,
    name: String(row.name),
    source: (row.source as CampaignAudienceList['source']) ?? 'subscribers',
    matchMode: (row.match_mode as CampaignAudienceList['matchMode']) ?? 'all',
    filters: row.filters ?? [],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
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
    return ((data ?? []) as Array<Record<string, unknown>>).map(mapList);
  }

  async create(input: {
    accountId: string;
    userId: string;
    name: string;
    filters: AudienceListFilters;
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
        filters: filters.rules,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Could not save audience list');
    }
    return mapList(data as Record<string, unknown>);
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
      patch.filters = filters.rules;
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
}
