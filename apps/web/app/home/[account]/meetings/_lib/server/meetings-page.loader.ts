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
  dealTitle: string | null;
  participants: MeetingParticipant[];
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
): MeetingTranscriptListRow {
  return {
    id: transcript.id,
    title: transcript.title,
    content: transcript.content,
    source: transcript.source,
    meetingDate: transcript.meetingDate,
    createdAt: transcript.createdAt,
    clientId: transcript.clientId,
    clientName: transcript.clientName,
    dealTitle: transcript.dealTitle,
    participants: resolveMeetingParticipants(
      transcript.speakerMappings,
      clients,
      contacts,
    ),
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

  const clients = mapClientOptions(clientsResult.data ?? []);
  const contacts = mapContactOptions(contactsResult.data ?? []);

  return {
    accountId,
    accountSlug,
    transcripts: transcripts.map((transcript) =>
      mapTranscriptListRow(transcript, clients, contacts),
    ),
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

  const [transcript, clientsResult, contactsResult, membersResult, summary] =
    await Promise.all([
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
    ]);

  if (membersResult.error) {
    throw new Error(membersResult.error.message);
  }

  return {
    accountId,
    accountSlug,
    transcript,
    summary,
    clients: mapClientOptions(clientsResult.data ?? []),
    contacts: mapContactOptions(contactsResult.data ?? []),
    members: mapMemberOptions(membersResult.data ?? []),
    currentUserId: workspace.user.id,
    canEdit: access.canEditClients,
    canView: access.canViewClients,
  };
}
