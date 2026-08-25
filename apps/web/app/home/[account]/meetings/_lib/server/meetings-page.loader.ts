import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { getTeamAccountAccess } from '~/home/[account]/_lib/role-access';
import {
  type MeetingTranscriptListItem,
  createMeetingTranscriptsService,
} from '~/home/[account]/_lib/server/meeting-transcripts.service';
import { loadTeamWorkspace } from '~/home/[account]/_lib/server/team-account-workspace.loader';
import { createClientsService } from '~/home/[account]/clients/_lib/server/clients.service';
import {
  type MeetingParticipant,
  resolveMeetingParticipants,
} from '~/lib/recorder/meeting-participants';
import { loadMeetingSummary } from '~/lib/recorder/meeting-summary';

export type MeetingClientOption = {
  id: string;
  name: string;
  pictureUrl?: string | null;
};
export type MeetingContactOption = {
  id: string;
  name: string;
  email?: string | null;
  pictureUrl?: string | null;
};

export type MeetingMemberOption = {
  userId: string;
  name: string;
  email: string;
};

export type MeetingTranscriptListRow = {
  id: string;
  title: string;
  content: string;
  source: string;
  meetingDate: string | null;
  createdAt: string;
  clientId: string | null;
  clientName: string | null;
  clientPictureUrl: string | null;
  dealTitle: string | null;
  participants: MeetingParticipant[];
  hasExtractedTasks: boolean;
};

function mapClientOptions(
  rows: Array<{
    id: unknown;
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    company_name?: string | null;
    picture_url?: string | null;
  }>,
): MeetingClientOption[] {
  return rows
    .map((row) => ({
      id: row.id as string,
      name:
        row.display_name?.trim() ||
        row.company_name?.trim() ||
        [row.first_name as string, row.last_name as string]
          .filter(Boolean)
          .join(' ')
          .trim() ||
        'Unnamed client',
      pictureUrl: row.picture_url ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function mapMemberOptions(rows: unknown[]): MeetingMemberOption[] {
  return rows
    .map((row) => {
      const member = row as {
        user_id?: string;
        name?: string | null;
        email?: string | null;
      };

      const userId = member.user_id?.trim();
      const email = member.email?.trim();

      if (!userId || !email) {
        return null;
      }

      return {
        userId,
        name: member.name?.trim() || email,
        email,
      };
    })
    .filter((member): member is MeetingMemberOption => member !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function mapContactOptions(
  rows: Array<{
    id: string;
    full_name: string;
    email?: string | null;
    picture_url?: string | null;
  }>,
): MeetingContactOption[] {
  return rows
    .map((row) => ({
      id: row.id,
      name: row.full_name.trim() || 'Unnamed contact',
      email: row.email ?? null,
      pictureUrl: row.picture_url ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function mapTranscriptListRow(
  transcript: MeetingTranscriptListItem,
  clients: MeetingClientOption[],
  contacts: MeetingContactOption[],
  extractedTranscriptIds: Set<string>,
): MeetingTranscriptListRow {
  const linkedClient = transcript.clientId
    ? clients.find((client) => client.id === transcript.clientId)
    : undefined;

  return {
    id: transcript.id,
    title: transcript.title,
    content: transcript.content,
    source: transcript.source,
    meetingDate: transcript.meetingDate,
    createdAt: transcript.createdAt,
    clientId: transcript.clientId,
    clientName: transcript.clientName,
    clientPictureUrl: linkedClient?.pictureUrl ?? null,
    dealTitle: transcript.dealTitle,
    participants: resolveMeetingParticipants(
      transcript.speakerMappings,
      clients,
      contacts,
    ),
    hasExtractedTasks: extractedTranscriptIds.has(transcript.id),
  };
}

export const loadMeetingsPageData = cache(loadMeetingsPageDataImpl);

async function loadMeetingsPageDataImpl(accountSlug: string) {
  const workspace = await loadTeamWorkspace(accountSlug);
  const accountId = workspace.account.id as string;
  const client = getSupabaseServerClient();

  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  const transcriptsService = createMeetingTranscriptsService(client);
  const clientsService = createClientsService(client);

  const [transcripts, clientsResult, contactsResult] = await Promise.all([
    transcriptsService.listForAccount({ accountId }),
    clientsService.listClients({
      accountId,
      page: 1,
      pageSize: 100,
    }),
    clientsService.listWorkspaceContacts({ accountId }),
  ]);

  const extractedTranscriptIds = new Set<string>();
  if (transcripts.length > 0) {
    const { data: actionItems, error: actionItemsError } = await client
      .from('meeting_action_items')
      .select('meeting_transcript_id')
      .eq('account_id', accountId)
      .in(
        'meeting_transcript_id',
        transcripts.map((transcript) => transcript.id),
      )
      .in('status', ['pending_review', 'approved', 'auto_published']);

    if (actionItemsError) {
      throw new Error(actionItemsError.message);
    }

    for (const row of actionItems ?? []) {
      const transcriptId = (row as { meeting_transcript_id?: string })
        .meeting_transcript_id;
      if (transcriptId) {
        extractedTranscriptIds.add(transcriptId);
      }
    }
  }

  const clients = mapClientOptions(clientsResult.data ?? []);
  const contacts = mapContactOptions(contactsResult.data ?? []);

  let upcomingMeetings: Array<{
    id: string;
    title: string;
    startAt: string;
    inviteeName: string;
    conferencingUrl: string | null;
  }> = [];

  try {
    const { createSchedulingService } =
      await import('~/home/[account]/scheduling/_lib/server/scheduling.service');
    const { upcoming } =
      await createSchedulingService(client).listBookings(accountId);
    const now = Date.now();
    upcomingMeetings = upcoming
      .filter((row) => new Date(row.startAt).getTime() >= now)
      .slice(0, 8)
      .map((row) => ({
        id: row.id,
        title:
          row.eventTypeName?.trim() ||
          row.bookingPageTitle?.trim() ||
          'Meeting',
        startAt: row.startAt,
        inviteeName: row.inviteeName,
        conferencingUrl: row.conferencingUrl,
      }));
  } catch (error) {
    console.warn('[meetings] load upcoming bookings failed', error);
  }

  return {
    accountId,
    accountSlug,
    transcripts: transcripts.map((transcript) =>
      mapTranscriptListRow(
        transcript,
        clients,
        contacts,
        extractedTranscriptIds,
      ),
    ),
    upcomingMeetings,
    clients,
    contacts,
    canEdit: access.canEditClients,
    canView: access.canViewClients,
  };
}

export const loadMeetingTranscriptPageData = cache(
  loadMeetingTranscriptPageDataImpl,
);

async function loadMeetingTranscriptPageDataImpl(
  accountSlug: string,
  transcriptId: string,
) {
  const workspace = await loadTeamWorkspace(accountSlug);
  const accountId = workspace.account.id as string;
  const client = getSupabaseServerClient();

  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  const transcriptsService = createMeetingTranscriptsService(client);
  const clientsService = createClientsService(client);

  const [
    transcript,
    clientsResult,
    contactsResult,
    membersResult,
    summary,
    actionItemsResult,
  ] = await Promise.all([
    transcriptsService.getById({
      accountId,
      transcriptId,
    }),
    clientsService.listClients({
      accountId,
      page: 1,
      pageSize: 100,
    }),
    clientsService.listWorkspaceContacts({ accountId }),
    client.rpc('get_account_members', { account_slug: accountSlug }),
    loadMeetingSummary(client, {
      meetingTranscriptId: transcriptId,
      accountId,
    }),
    client
      .from('meeting_action_items')
      .select(
        'id, suggested_title, suggested_description, suggested_due_date, suggested_assignee_id, status, planner_task_id',
      )
      .eq('meeting_transcript_id', transcriptId)
      .eq('account_id', accountId)
      .in('status', ['approved', 'auto_published'])
      .order('created_at', { ascending: true }),
  ]);

  if (membersResult.error) {
    throw new Error(membersResult.error.message);
  }

  if (actionItemsResult.error) {
    throw new Error(actionItemsResult.error.message);
  }

  const actionItemRows = (actionItemsResult.data ?? []) as Array<
    Record<string, unknown>
  >;

  const plannerTaskIds = actionItemRows
    .map((row) => row.planner_task_id as string | null)
    .filter((id): id is string => Boolean(id));

  const plannerById = new Map<
    string,
    {
      title: string | null;
      dueDate: string | null;
      userId: string | null;
      contactId: string | null;
      status: string | null;
    }
  >();

  if (plannerTaskIds.length > 0) {
    const { data: plannerRows } = await client
      .from('tasks')
      .select('id, title, due_date, user_id, assignee_contact_id, status')
      .eq('account_id', accountId)
      .in('id', plannerTaskIds);

    for (const row of (plannerRows ?? []) as Array<Record<string, unknown>>) {
      plannerById.set(row.id as string, {
        title: (row.title as string | null) ?? null,
        dueDate: (row.due_date as string | null) ?? null,
        userId: (row.user_id as string | null) ?? null,
        contactId: (row.assignee_contact_id as string | null) ?? null,
        status: (row.status as string | null) ?? null,
      });
    }
  }

  const members = mapMemberOptions(membersResult.data ?? []);
  const memberNameById = new Map(
    members.map((member) => [member.userId, member.name] as const),
  );
  const contacts = mapContactOptions(contactsResult.data ?? []);
  const contactNameById = new Map(
    contacts.map((contact) => [contact.id, contact.name] as const),
  );

  const unresolvedUserIds = new Set<string>();
  for (const row of actionItemRows) {
    const plannerTaskId = (row.planner_task_id as string | null) ?? null;
    const planner = plannerTaskId ? plannerById.get(plannerTaskId) : undefined;
    const assigneeUserId =
      planner?.userId ?? (row.suggested_assignee_id as string | null) ?? null;
    if (assigneeUserId && !memberNameById.has(assigneeUserId)) {
      unresolvedUserIds.add(assigneeUserId);
    }
  }

  if (unresolvedUserIds.size > 0) {
    const { data: accountRows } = await client
      .from('accounts')
      .select('id, name, email')
      .in('id', [...unresolvedUserIds]);

    for (const row of (accountRows ?? []) as Array<{
      id: string;
      name?: string | null;
      email?: string | null;
    }>) {
      memberNameById.set(
        row.id,
        row.name?.trim() || row.email?.trim() || 'Team member',
      );
    }
  }

  const meetingTasks = actionItemRows.map((row) => {
    const plannerTaskId = (row.planner_task_id as string | null) ?? null;
    const planner = plannerTaskId ? plannerById.get(plannerTaskId) : undefined;
    const assigneeUserId =
      planner?.userId ?? (row.suggested_assignee_id as string | null) ?? null;
    const assigneeContactId = planner?.contactId ?? null;
    const assigneeName = assigneeUserId
      ? (memberNameById.get(assigneeUserId) ?? null)
      : assigneeContactId
        ? (contactNameById.get(assigneeContactId) ?? null)
        : null;

    return {
      id: (plannerTaskId as string) || (row.id as string),
      title:
        planner?.title?.trim() ||
        ((row.suggested_title as string | null) ?? 'Task').trim() ||
        'Task',
      description: (row.suggested_description as string | null)?.trim() || null,
      dueDate:
        planner?.dueDate ?? (row.suggested_due_date as string | null) ?? null,
      status: planner?.status ?? (row.status as string) ?? 'approved',
      assigneeName,
      plannerTaskId,
    };
  });

  return {
    accountId,
    accountSlug,
    transcript: transcript
      ? {
          ...transcript,
          publicShareToken: access.canEditClients
            ? transcript.publicShareToken
            : null,
          publicShareEnabled: access.canEditClients
            ? transcript.publicShareEnabled
            : false,
          publicShareShowTasks: access.canEditClients
            ? transcript.publicShareShowTasks
            : false,
          portalVisible: access.canEditClients
            ? transcript.portalVisible
            : false,
        }
      : transcript,
    summary,
    meetingTasks,
    clients: mapClientOptions(clientsResult.data ?? []),
    contacts,
    members,
    currentUserId: workspace.user.id,
    canEdit: access.canEditClients,
    canView: access.canViewClients,
  };
}
