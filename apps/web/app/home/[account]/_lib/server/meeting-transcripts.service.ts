import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

import type { Database } from '~/lib/database.types';

import { queueBrainDeleteSource, queueBrainIndexSource } from '~/lib/brain/sync';
import {
  parseTranscriptContent,
  renameSpeakersInSegments,
  resolveTranscriptSegments,
  serializeTranscriptSegments,
  type TranscriptSegment,
} from '~/lib/recorder/transcript-speakers';

export type MeetingCalendarAttendee = {
  name: string;
  email: string;
};

export type MeetingTranscript = {
  id: string;
  accountId: string;
  clientId: string | null;
  dealId: string | null;
  title: string;
  content: string;
  speakerSegments: TranscriptSegment[];
  calendarAttendees: MeetingCalendarAttendee[];
  source: 'paste' | 'upload' | 'desktop_recorder';
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
  speaker_segments?: unknown;
  calendar_attendees?: unknown;
  source?: string | null;
  file_path?: string | null;
  meeting_date?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeCalendarAttendees(value: unknown): MeetingCalendarAttendee[] {
  if (!Array.isArray(value)) return [];

  const attendees: MeetingCalendarAttendee[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const name = (item as { name?: unknown }).name;
    const email = (item as { email?: unknown }).email;
    attendees.push({
      name: typeof name === 'string' && name.trim() ? name.trim() : 'Guest',
      email: typeof email === 'string' ? email.trim() : '',
    });
  }

  return attendees;
}

function mapMeetingTranscript(row: MeetingTranscriptRow): MeetingTranscript {
  const content = row.content ?? '';
  return {
    id: row.id,
    accountId: row.account_id,
    clientId: row.client_id ?? null,
    dealId: row.deal_id ?? null,
    title: row.title?.trim() || 'Meeting transcript',
    content,
    speakerSegments: resolveTranscriptSegments({
      content,
      speakerSegments: row.speaker_segments,
    }),
    calendarAttendees: normalizeCalendarAttendees(row.calendar_attendees),
    source:
      row.source === 'upload'
        ? 'upload'
        : row.source === 'desktop_recorder'
          ? 'desktop_recorder'
          : 'paste',
    filePath: row.file_path ?? null,
    meetingDate: row.meeting_date ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeEmbeddedRow<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function clientDisplayName(row: {
  display_name?: string | null;
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
} | null) {
  if (!row) return null;
  const named =
    row.display_name?.trim() ||
    row.company_name?.trim() ||
    [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
    row.name?.trim();
  return named || null;
}

function pipelineDealTitle(
  deal: {
    name?: string | null;
    contact_name?: string | null;
    company_name?: string | null;
  } | null,
) {
  if (!deal) return null;
  return (
    deal.contact_name?.trim() ||
    deal.company_name?.trim() ||
    deal.name?.trim() ||
    null
  );
}

function mapMeetingTranscriptListItem(
  row: MeetingTranscriptRow & {
    clients?:
      | {
          display_name?: string | null;
          company_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          name?: string | null;
        }
      | {
          display_name?: string | null;
          company_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          name?: string | null;
        }[]
      | null;
    pipeline_deals?:
      | {
          name?: string | null;
          contact_name?: string | null;
          company_name?: string | null;
        }
      | {
          name?: string | null;
          contact_name?: string | null;
          company_name?: string | null;
        }[]
      | null;
  },
): MeetingTranscriptListItem {
  const client = normalizeEmbeddedRow(row.clients ?? null);
  const deal = normalizeEmbeddedRow(row.pipeline_deals ?? null);

  return {
    ...mapMeetingTranscript(row),
    clientName: clientDisplayName(client),
    dealTitle: pipelineDealTitle(deal),
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

  private async resolveClientNames(
    accountId: string,
    clientIds: string[],
  ): Promise<Map<string, string>> {
    const unique = [...new Set(clientIds.filter(Boolean))];
    if (unique.length === 0) return new Map();

    const { data, error } = await this.db
      .from('clients')
      .select('id, display_name, company_name, first_name, last_name')
      .eq('account_id', accountId)
      .in('id', unique);

    if (error) throw new Error(error.message);

    const map = new Map<string, string>();
    for (const row of (data ?? []) as Array<{
      id: string;
      display_name?: string | null;
      company_name?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      name?: string | null;
    }>) {
      const label = clientDisplayName(row);
      if (label) map.set(row.id, label);
    }

    return map;
  }

  private applyResolvedClientNames(
    items: MeetingTranscriptListItem[],
    namesByClientId: Map<string, string>,
  ) {
    return items.map((item) => {
      if (item.clientName || !item.clientId) return item;
      const resolved = namesByClientId.get(item.clientId);
      return resolved ? { ...item, clientName: resolved } : item;
    });
  }

  private async assertClientInAccount(accountId: string, clientId: string) {
    const { data, error } = await this.db
      .from('clients')
      .select('id')
      .eq('account_id', accountId)
      .eq('id', clientId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Client not found in this workspace');
  }

  private async assertDealInAccount(accountId: string, dealId: string) {
    const { data, error } = await this.db
      .from('pipeline_deals')
      .select('id')
      .eq('account_id', accountId)
      .eq('id', dealId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Deal not found in this workspace');
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
        '*, clients(display_name, company_name, first_name, last_name), pipeline_deals(name, contact_name, company_name)',
      )
      .eq('account_id', input.accountId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    const items = ((data ?? []) as MeetingTranscriptRow[]).map((row) =>
      mapMeetingTranscriptListItem(
        row as Parameters<typeof mapMeetingTranscriptListItem>[0],
      ),
    );

    const missingClientIds = items
      .filter((item) => item.clientId && !item.clientName)
      .map((item) => item.clientId as string);
    const namesByClientId = await this.resolveClientNames(
      input.accountId,
      missingClientIds,
    );

    const enriched = this.applyResolvedClientNames(items, namesByClientId);

    return enriched.sort((a, b) => {
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
        '*, clients(display_name, company_name, first_name, last_name), pipeline_deals(name, contact_name, company_name)',
      )
      .eq('account_id', input.accountId)
      .eq('id', input.transcriptId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    let item = mapMeetingTranscriptListItem(
      data as Parameters<typeof mapMeetingTranscriptListItem>[0],
    );

    if (item.clientId && !item.clientName) {
      const namesByClientId = await this.resolveClientNames(input.accountId, [
        item.clientId,
      ]);
      item = this.applyResolvedClientNames([item], namesByClientId)[0] ?? item;
    }

    return item;
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

    const content = input.content.trim();
    const parsed = parseTranscriptContent(content);
    const speakerSegments = parsed.hasSpeakerLabels ? parsed.segments : null;

    const { data, error } = await this.db
      .from('meeting_transcripts')
      .insert({
        account_id: input.accountId,
        client_id: clientId,
        deal_id: dealId,
        title: input.title?.trim() || 'Meeting transcript',
        // Content MUST be a Markdown string — see lib/markdown.ts contract.
        content,
        speaker_segments: speakerSegments,
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
    clientId?: string | null;
    dealId?: string | null;
  }): Promise<MeetingTranscriptListItem> {
    await this.ensureUserAndPermission(input.accountId, 'invoices.edit');

    const existing = await this.getById({
      accountId: input.accountId,
      transcriptId: input.transcriptId,
    });
    if (!existing) throw new Error('Transcript not found');

    const payload: Record<string, string | null> = {};
    if (input.title !== undefined) {
      payload.title = input.title.trim() || 'Meeting transcript';
    }
    if (input.meetingDate !== undefined) {
      payload.meeting_date = input.meetingDate?.trim() || null;
    }

    const nextClientId =
      input.clientId !== undefined
        ? input.clientId?.trim() || null
        : existing.clientId;
    const nextDealId =
      input.dealId !== undefined ? input.dealId?.trim() || null : existing.dealId;

    if (input.clientId !== undefined || input.dealId !== undefined) {
      if (!nextClientId && !nextDealId) {
        throw new Error('Link the meeting to a client or deal');
      }
      if (nextClientId) {
        await this.assertClientInAccount(input.accountId, nextClientId);
      }
      if (nextDealId) {
        await this.assertDealInAccount(input.accountId, nextDealId);
      }
      payload.client_id = nextClientId;
      payload.deal_id = nextDealId;
    }

    if (Object.keys(payload).length === 0) {
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

    const updated = await this.getById({
      accountId: input.accountId,
      transcriptId: input.transcriptId,
    });
    if (!updated) throw new Error('Transcript not found');
    return updated;
  }

  async updateSpeakerLabels(input: {
    accountId: string;
    transcriptId: string;
    renames: Record<string, string>;
  }): Promise<MeetingTranscriptListItem> {
    await this.ensureUserAndPermission(input.accountId, 'invoices.edit');

    const existing = await this.getById({
      accountId: input.accountId,
      transcriptId: input.transcriptId,
    });
    if (!existing) throw new Error('Transcript not found');

    const segments = existing.speakerSegments;
    if (segments.length === 0) {
      throw new Error('This transcript has no speaker labels to rename');
    }

    const normalizedRenames: Record<string, string> = {};
    for (const [from, to] of Object.entries(input.renames)) {
      const next = to.trim();
      if (!from.trim() || !next || from.trim() === next) continue;
      normalizedRenames[from.trim()] = next;
    }

    if (Object.keys(normalizedRenames).length === 0) {
      return existing;
    }

    const nextSegments = renameSpeakersInSegments(segments, normalizedRenames);
    const content = serializeTranscriptSegments(nextSegments);

    const { error } = await this.db
      .from('meeting_transcripts')
      .update({
        content,
        speaker_segments: nextSegments,
      })
      .eq('id', input.transcriptId)
      .eq('account_id', input.accountId);

    if (error) throw new Error(error.message);

    queueBrainIndexSource(input.accountId, 'transcript', input.transcriptId);

    const updated = await this.getById({
      accountId: input.accountId,
      transcriptId: input.transcriptId,
    });
    if (!updated) throw new Error('Transcript not found');
    return updated;
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
