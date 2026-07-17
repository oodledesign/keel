import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export type MeetingActionItemForIndex = {
  suggested_title: string;
  suggested_description?: string | null;
  source_excerpt?: string | null;
};

export function buildMeetingTranscriptIndexText(params: {
  title: string;
  content: string;
  meetingDate?: string | null;
  clientName?: string | null;
  summaryText?: string | null;
  attendeeEmails?: string[] | null;
  actionItems?: MeetingActionItemForIndex[];
}) {
  const lines = [`# ${params.title}`];
  if (params.clientName) lines.push(`Client: ${params.clientName}`);
  if (params.meetingDate) lines.push(`Meeting date: ${params.meetingDate}`);
  if (params.attendeeEmails?.length) {
    lines.push(`Attendees: ${params.attendeeEmails.join(', ')}`);
  }
  if (params.summaryText?.trim()) {
    lines.push('', '## Meeting summary', '', params.summaryText.trim());
  }
  if (params.actionItems?.length) {
    lines.push('', '## Action items');
    for (const item of params.actionItems) {
      lines.push(`- ${item.suggested_title}`);
      if (item.suggested_description?.trim()) {
        lines.push(`  ${item.suggested_description.trim()}`);
      }
      if (item.source_excerpt?.trim()) {
        lines.push(`  Excerpt: ${item.source_excerpt.trim()}`);
      }
    }
  }
  lines.push('', '## Transcript', '', params.content);
  return lines.join('\n');
}

export type MeetingTranscriptEnrichment = {
  summaryText: string | null;
  attendeeEmails: string[];
  summaryGeneratedAt: string | null;
  actionItems: MeetingActionItemForIndex[];
  latestActionItemAt: string | null;
};

export async function loadMeetingTranscriptEnrichmentByIds(
  admin: SupabaseClient,
  accountId: string,
  transcriptIds: string[],
): Promise<Map<string, MeetingTranscriptEnrichment>> {
  const result = new Map<string, MeetingTranscriptEnrichment>();

  if (transcriptIds.length === 0) {
    return result;
  }

  const { data: summaries } = await admin
    .from('meeting_summaries')
    .select(
      'meeting_transcript_id, summary_text, attendee_emails, generated_at',
    )
    .eq('account_id', accountId)
    .in('meeting_transcript_id', transcriptIds);

  for (const row of summaries ?? []) {
    const transcriptId = row.meeting_transcript_id as string;
    result.set(transcriptId, {
      summaryText: (row.summary_text as string | null)?.trim() || null,
      attendeeEmails: (row.attendee_emails as string[] | null) ?? [],
      summaryGeneratedAt: (row.generated_at as string | null) ?? null,
      actionItems: [],
      latestActionItemAt: null,
    });
  }

  const { data: actionItems } = await admin
    .from('meeting_action_items')
    .select(
      'meeting_transcript_id, suggested_title, suggested_description, source_excerpt, created_at',
    )
    .eq('account_id', accountId)
    .in('meeting_transcript_id', transcriptIds)
    .order('created_at', { ascending: true });

  for (const row of actionItems ?? []) {
    const transcriptId = row.meeting_transcript_id as string;
    const current = result.get(transcriptId) ?? {
      summaryText: null,
      attendeeEmails: [],
      summaryGeneratedAt: null,
      actionItems: [],
      latestActionItemAt: null,
    };

    current.actionItems.push({
      suggested_title: row.suggested_title as string,
      suggested_description: row.suggested_description as string | null,
      source_excerpt: row.source_excerpt as string | null,
    });

    const createdAt = row.created_at as string;
    if (!current.latestActionItemAt || createdAt > current.latestActionItemAt) {
      current.latestActionItemAt = createdAt;
    }

    result.set(transcriptId, current);
  }

  return result;
}

export function meetingTranscriptIndexUpdatedAt(
  transcriptUpdatedAt: string,
  enrichment?: MeetingTranscriptEnrichment,
) {
  const candidates = [transcriptUpdatedAt];

  if (enrichment?.summaryGeneratedAt) {
    candidates.push(enrichment.summaryGeneratedAt);
  }
  if (enrichment?.latestActionItemAt) {
    candidates.push(enrichment.latestActionItemAt);
  }

  return candidates.reduce((latest, value) =>
    value > latest ? value : latest,
  );
}
