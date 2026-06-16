import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { createClientsService } from '~/home/[account]/clients/_lib/server/clients.service';
import { getTeamAccountAccess } from '~/home/[account]/_lib/role-access';
import { loadTeamWorkspace } from '~/home/[account]/_lib/server/team-account-workspace.loader';

import { createMeetingTranscriptsService } from '~/home/[account]/_lib/server/meeting-transcripts.service';

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

  const clients = (clientsResult.data ?? [])
    .map((row) => ({
      id: row.id as string,
      name:
        (row.display_name as string | null)?.trim() ||
        [(row.first_name as string), (row.last_name as string)]
          .filter(Boolean)
          .join(' ')
          .trim() ||
        'Unnamed client',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

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

  const transcript = await createMeetingTranscriptsService(client).getById({
    accountId,
    transcriptId,
  });

  return {
    accountId,
    accountSlug,
    transcript,
    canEdit: access.canEditClients,
    canView: access.canViewClients,
  };
}
