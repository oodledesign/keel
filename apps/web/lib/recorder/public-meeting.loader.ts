import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { loadAccountBrandResolved } from '~/lib/brand/account-brand';
import {
  type TranscriptSegment,
  normalizeSpeakerMappings,
  resolveTranscriptSegments,
  segmentsWithResolvedSpeakers,
} from '~/lib/recorder/transcript-speakers';
import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

export type PublicMeetingTask = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  /** Planner task status when published; otherwise approved/auto_published. */
  status: string;
  completed: boolean;
};

export type PublicMeetingParty = {
  name: string;
  logoUrl: string | null;
};

export type PublicMeetingPayload = {
  id: string;
  title: string;
  meetingDate: string | null;
  content: string;
  speakerSegments: TranscriptSegment[];
  summaryText: string | null;
  attendeeEmails: string[];
  tasks: PublicMeetingTask[];
  showTasks: boolean;
  business: PublicMeetingParty | null;
  client: PublicMeetingParty | null;
};

function clientDisplayName(
  row: {
    display_name?: string | null;
    company_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null,
): string | null {
  if (!row) return null;
  return (
    row.display_name?.trim() ||
    row.company_name?.trim() ||
    [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
    null
  );
}

function contactDisplayName(row: {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}): string {
  return (
    row.full_name?.trim() ||
    [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
    row.email?.trim() ||
    'Contact'
  );
}

export async function loadPublicMeetingByToken(
  token: string,
): Promise<PublicMeetingPayload | null> {
  const normalized = token.trim();
  if (!normalized || normalized.length < 16) {
    return null;
  }

  const admin = getSupabaseServerAdminClient() as unknown as SupabaseClient;

  const { data: transcript, error } = await admin
    .from('meeting_transcripts')
    .select(
      'id, account_id, client_id, title, content, meeting_date, speaker_segments, speaker_mappings, public_share_enabled, public_share_token, public_share_show_tasks',
    )
    .eq('public_share_token', normalized)
    .eq('public_share_enabled', true)
    .maybeSingle();

  if (error || !transcript) {
    return null;
  }

  const transcriptId = transcript.id as string;
  const accountId = transcript.account_id as string;
  const clientId = (transcript.client_id as string | null) ?? null;
  const content = ((transcript.content as string | null) ?? '').trim();
  const mappings = normalizeSpeakerMappings(transcript.speaker_mappings);
  const showTasks = transcript.public_share_show_tasks !== false;

  const clientIds = new Set<string>();
  const contactIds = new Set<string>();
  const memberIds = new Set<string>();

  if (clientId) clientIds.add(clientId);
  for (const binding of Object.values(mappings)) {
    if (binding.type === 'client') clientIds.add(binding.clientId);
    if (binding.type === 'contact') contactIds.add(binding.contactId);
    if (binding.type === 'member') memberIds.add(binding.userId);
  }

  const [
    { data: summary },
    { data: actionItems },
    brand,
    { data: accountRow },
    { data: clientRows },
    { data: contactRows },
    { data: memberRows },
  ] = await Promise.all([
    admin
      .from('meeting_summaries')
      .select('summary_text, attendee_emails')
      .eq('meeting_transcript_id', transcriptId)
      .maybeSingle(),
    showTasks
      ? admin
          .from('meeting_action_items')
          .select(
            'id, suggested_title, suggested_description, suggested_due_date, status, planner_task_id',
          )
          .eq('meeting_transcript_id', transcriptId)
          .in('status', ['approved', 'auto_published'])
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    loadAccountBrandResolved(accountId),
    admin
      .from('accounts')
      .select('name, picture_url')
      .eq('id', accountId)
      .maybeSingle(),
    clientIds.size > 0
      ? admin
          .from('clients')
          .select(
            'id, display_name, company_name, first_name, last_name, picture_url',
          )
          .eq('account_id', accountId)
          .in('id', [...clientIds])
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    contactIds.size > 0
      ? admin
          .from('contacts')
          .select('id, full_name, first_name, last_name, email')
          .eq('account_id', accountId)
          .in('id', [...contactIds])
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    memberIds.size > 0
      ? admin
          .from('accounts')
          .select('id, name, email, picture_url')
          .in('id', [...memberIds])
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ]);

  const clients = (
    (clientRows ?? []) as Array<{
      id: string;
      display_name?: string | null;
      company_name?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      picture_url?: string | null;
    }>
  ).map((row) => ({
    id: row.id,
    name: clientDisplayName(row) || 'Client',
    pictureUrl: toSupabasePublicStorageUrl(row.picture_url) ?? null,
  }));

  const contacts = (
    (contactRows ?? []) as Array<{
      id: string;
      full_name?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      email?: string | null;
    }>
  ).map((row) => ({
    id: row.id,
    name: contactDisplayName(row),
  }));

  const members = (
    (memberRows ?? []) as Array<{
      id: string;
      name?: string | null;
      email?: string | null;
    }>
  ).map((row) => ({
    userId: row.id,
    name: row.name?.trim() || row.email?.trim() || 'Team member',
  }));

  const plannerTaskIds = (
    (actionItems ?? []) as Array<{ planner_task_id?: string | null }>
  )
    .map((row) => row.planner_task_id)
    .filter((id): id is string => Boolean(id));

  const plannerStatusById = new Map<string, string>();
  if (plannerTaskIds.length > 0) {
    const { data: plannerTasks } = await admin
      .from('tasks')
      .select('id, status')
      .eq('account_id', accountId)
      .in('id', plannerTaskIds);

    for (const task of (plannerTasks ?? []) as Array<{
      id: string;
      status?: string | null;
    }>) {
      plannerStatusById.set(task.id, task.status ?? 'todo');
    }
  }

  const tasks: PublicMeetingTask[] = (
    (actionItems ?? []) as Array<Record<string, unknown>>
  ).map((row) => {
    const plannerTaskId = row.planner_task_id as string | null;
    const plannerStatus = plannerTaskId
      ? plannerStatusById.get(plannerTaskId)
      : undefined;
    const status = plannerStatus ?? (row.status as string) ?? 'approved';
    const completed = plannerStatus === 'done';

    return {
      id: (plannerTaskId as string) || (row.id as string),
      title:
        ((row.suggested_title as string | null) ?? 'Task').trim() || 'Task',
      description: (row.suggested_description as string | null)?.trim() || null,
      dueDate: (row.suggested_due_date as string | null) ?? null,
      status,
      completed,
    };
  });

  const linkedClient = clientId
    ? (clients.find((row) => row.id === clientId) ?? null)
    : null;

  const businessName =
    (accountRow?.name as string | null | undefined)?.trim() || 'Workspace';
  const businessLogo =
    brand.logo_url ||
    toSupabasePublicStorageUrl(
      (accountRow?.picture_url as string | null | undefined)?.trim(),
    );

  const rawSegments = resolveTranscriptSegments({
    content,
    speakerSegments: transcript.speaker_segments,
  });

  return {
    id: transcriptId,
    title:
      ((transcript.title as string | null) ?? 'Meeting').trim() || 'Meeting',
    meetingDate: (transcript.meeting_date as string | null) ?? null,
    content,
    speakerSegments: segmentsWithResolvedSpeakers(
      rawSegments,
      mappings,
      clients,
      contacts,
      members,
    ),
    summaryText: (summary?.summary_text as string | null)?.trim() || null,
    attendeeEmails: Array.isArray(summary?.attendee_emails)
      ? (summary.attendee_emails as string[])
      : [],
    tasks,
    showTasks,
    business: {
      name: businessName,
      logoUrl: businessLogo,
    },
    client: linkedClient
      ? { name: linkedClient.name, logoUrl: linkedClient.pictureUrl }
      : null,
  };
}
