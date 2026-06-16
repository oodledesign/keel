import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

import type { Database } from '~/lib/database.types';

import { queueBrainDeleteSource, queueBrainIndexSource } from '~/lib/brain/sync';

export type MeetingTranscript = {
  id: string;
  accountId: string;
  clientId: string | null;
  dealId: string | null;
  title: string;
  content: string;
  source: 'paste' | 'upload';
  filePath: string | null;
  meetingDate: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MeetingTranscriptListItem = MeetingTranscript & {
  clientName: string | null;
  dealTitle: string | null;
};

type MeetingTranscriptRow = {
  id: string;
  account_id: string;
  client_id?: string | null;
  deal_id?: string | null;
  title?: string | null;
  content?: string | null;
  source?: string | null;
  file_path?: string | null;
  meeting_date?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
};

function mapMeetingTranscript(row: MeetingTranscriptRow): MeetingTranscript {
  return {
    id: row.id,
    accountId: row.account_id,
    clientId: row.client_id ?? null,
    dealId: row.deal_id ?? null,
    title: row.title?.trim() || 'Meeting transcript',
    content: row.content ?? '',
    source: row.source === 'upload' ? 'upload' : 'paste',
    filePath: row.file_path ?? null,
    meetingDate: row.meeting_date ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function clientDisplayName(row: {
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
} | null) {
  if (!row) return null;
  const named =
    row.display_name?.trim() ||
    [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
  return named || null;
}

function mapMeetingTranscriptListItem(
  row: MeetingTranscriptRow & {
    clients?: {
      display_name?: string | null;
      first_name?: string | null;
      last_name?: string | null;
    } | null;
    pipeline_deals?: { title?: string | null } | null;
  },
): MeetingTranscriptListItem {
  return {
    ...mapMeetingTranscript(row),
    clientName: clientDisplayName(row.clients ?? null),
    dealTitle: row.pipeline_deals?.title?.trim() || null,
  };
}

export function createMeetingTranscriptsService(
  client: SupabaseClient<Database>,
) {
  return new MeetingTranscriptsService(client);
}

class MeetingTranscriptsService {
  constructor(private readonly client: SupabaseClient<Database>) {}

  private get db(): any {
    return this.client;
  }

  private async ensureUser() {
    const { data: user } = await requireUser(this.client);
    if (!user) throw new Error('Authentication required');
    return user;
  }

  private async ensureUserAndPermission(
    accountId: string,
    permission: 'invoices.view' | 'invoices.edit',
  ) {
    const user = await this.ensureUser();
    const api = createTeamAccountsApi(this.client);
    const hasPermission = await api.hasPermission({
      userId: user.id,
      accountId,
      permission,
    });
    if (hasPermission) return user;

    const { data: membership, error } = await this.client
      .from('accounts_memberships')
      .select('account_role')
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;

    const role = membership?.account_role;
    if (permission === 'invoices.edit') {
      if (role === 'owner' || role === 'admin' || role === 'staff') {
        return user;
      }
    } else if (
      role === 'owner' ||
      role === 'admin' ||
      role === 'staff' ||
      role === 'member'
    ) {
      return user;
    }

    throw new Error('Permission denied');
  }

  async listForAccount(input: {
    accountId: string;
  }): Promise<MeetingTranscriptListItem[]> {
    await this.ensureUserAndPermission(input.accountId, 'invoices.view');

    const { data, error } = await this.db
      .from('meeting_transcripts')
      .select(
        '*, clients(display_name, first_name, last_name), pipeline_deals(title)',
      )
      .eq('account_id', input.accountId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    const items = ((data ?? []) as MeetingTranscriptRow[]).map((row) =>
      mapMeetingTranscriptListItem(
        row as Parameters<typeof mapMeetingTranscriptListItem>[0],
      ),
    );

    return items.sort((a, b) => {
      const aKey = a.meetingDate ?? a.createdAt.slice(0, 10);
      const bKey = b.meetingDate ?? b.createdAt.slice(0, 10);
      if (aKey !== bKey) {
        return bKey.localeCompare(aKey);
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
  }

  async getById(input: {
    accountId: string;
    transcriptId: string;
  }): Promise<MeetingTranscriptListItem | null> {
    await this.ensureUserAndPermission(input.accountId, 'invoices.view');

    const { data, error } = await this.db
      .from('meeting_transcripts')
      .select(
        '*, clients(display_name, first_name, last_name), pipeline_deals(title)',
      )
      .eq('account_id', input.accountId)
      .eq('id', input.transcriptId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    return mapMeetingTranscriptListItem(
      data as Parameters<typeof mapMeetingTranscriptListItem>[0],
    );
  }

  async listForClient(input: {
    accountId: string;
    clientId: string;
  }): Promise<MeetingTranscript[]> {
    await this.ensureUserAndPermission(input.accountId, 'invoices.view');

    const { data, error } = await this.db
      .from('meeting_transcripts')
      .select('*')
      .eq('account_id', input.accountId)
      .eq('client_id', input.clientId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return ((data ?? []) as MeetingTranscriptRow[]).map(mapMeetingTranscript);
  }

  async listForDeal(input: {
    accountId: string;
    dealId: string;
  }): Promise<MeetingTranscript[]> {
    await this.ensureUserAndPermission(input.accountId, 'invoices.view');

    const { data, error } = await this.db
      .from('meeting_transcripts')
      .select('*')
      .eq('account_id', input.accountId)
      .eq('deal_id', input.dealId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return ((data ?? []) as MeetingTranscriptRow[]).map(mapMeetingTranscript);
  }

  async create(input: {
    accountId: string;
    clientId?: string | null;
    dealId?: string | null;
    title?: string;
    content: string;
    source?: 'paste' | 'upload';
    filePath?: string | null;
    meetingDate?: string | null;
  }): Promise<MeetingTranscript> {
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'invoices.edit',
    );

    const clientId = input.clientId?.trim() || null;
    const dealId = input.dealId?.trim() || null;
    if (!clientId && !dealId) {
      throw new Error('A client or deal is required');
    }

    const { data, error } = await this.db
      .from('meeting_transcripts')
      .insert({
        account_id: input.accountId,
        client_id: clientId,
        deal_id: dealId,
        title: input.title?.trim() || 'Meeting transcript',
        // Content MUST be a Markdown string — see lib/markdown.ts contract.
        content: input.content.trim(),
        source: input.source ?? 'paste',
        file_path: input.filePath?.trim() || null,
        meeting_date: input.meetingDate?.trim() || null,
        created_by: user.id,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Failed to create meeting transcript');
    }

    queueBrainIndexSource(
      input.accountId,
      'transcript',
      (data as MeetingTranscriptRow).id,
    );

    return mapMeetingTranscript(data as MeetingTranscriptRow);
  }

  async update(input: {
    accountId: string;
    transcriptId: string;
    title?: string;
    meetingDate?: string | null;
  }): Promise<MeetingTranscript> {
    await this.ensureUserAndPermission(input.accountId, 'invoices.edit');

    const payload: Record<string, string | null> = {};
    if (input.title !== undefined) {
      payload.title = input.title.trim() || 'Meeting transcript';
    }
    if (input.meetingDate !== undefined) {
      payload.meeting_date = input.meetingDate?.trim() || null;
    }

    if (Object.keys(payload).length === 0) {
      const existing = await this.getById({
        accountId: input.accountId,
        transcriptId: input.transcriptId,
      });
      if (!existing) throw new Error('Transcript not found');
      return existing;
    }

    const { data, error } = await this.db
      .from('meeting_transcripts')
      .update(payload)
      .eq('id', input.transcriptId)
      .eq('account_id', input.accountId)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Failed to update meeting transcript');
    }

    queueBrainIndexSource(input.accountId, 'transcript', input.transcriptId);

    return mapMeetingTranscript(data as MeetingTranscriptRow);
  }

  async delete(input: {
    accountId: string;
    transcriptId: string;
  }): Promise<void> {
    await this.ensureUserAndPermission(input.accountId, 'invoices.edit');

    const { error } = await this.db
      .from('meeting_transcripts')
      .delete()
      .eq('id', input.transcriptId)
      .eq('account_id', input.accountId);

    if (error) throw new Error(error.message);

    queueBrainDeleteSource(input.transcriptId);
  }
}
