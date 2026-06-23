import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { createClientsService } from '~/home/[account]/clients/_lib/server/clients.service';
import { getTeamAccountAccess } from '~/home/[account]/_lib/role-access';
import { loadTeamWorkspace } from '~/home/[account]/_lib/server/team-account-workspace.loader';

import { createMeetingTranscriptsService } from '~/home/[account]/_lib/server/meeting-transcripts.service';
import { loadMeetingSummary } from '~/lib/recorder/meeting-summary';

export type MeetingClientOption = { id: string; name: string };
export type MeetingContactOption = {
  id: string;
  name: string;
  email?: string | null;
};

function mapClientOptions(
  rows: Array<{
    id: unknown;
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    company_name?: string | null;
  }>,
): MeetingClientOption[] {
  return rows
    .map((row) => ({
      id: row.id as string,
      name:
        row.display_name?.trim() ||
        row.company_name?.trim() ||
        [(row.first_name as string), (row.last_name as string)]
          .filter(Boolean)
          .join(' ')
          .trim() ||
        'Unnamed client',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function mapContactOptions(
  rows: Array<{
    id: string;
    full_name: string;
    email?: string | null;
  }>,
): MeetingContactOption[] {
  return rows
    .map((row) => ({
      id: row.id,
      name: row.full_name.trim() || 'Unnamed contact',
      email: row.email ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
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

  const [transcripts, clientsResult] = await Promise.all([
    transcriptsService.listForAccount({ accountId }),
    clientsService.listClients({
      accountId,
      page: 1,
      pageSize: 100,
    }),
  ]);

  const clients = mapClientOptions(clientsResult.data ?? []);

  return {
    accountId,
    accountSlug,
    transcripts,
    clients,
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

  const [transcript, clientsResult, contactsResult, summary] = await Promise.all([
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
    loadMeetingSummary(client, { meetingTranscriptId: transcriptId, accountId }),
  ]);

  return {
    accountId,
    accountSlug,
    transcript,
    summary,
    clients: mapClientOptions(clientsResult.data ?? []),
    contacts: mapContactOptions(contactsResult.data ?? []),
    canEdit: access.canEditClients,
    canView: access.canViewClients,
  };
}
