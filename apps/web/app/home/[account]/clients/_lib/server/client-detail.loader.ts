import 'server-only';

import { cache } from 'react';

import { notFound } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { getAgencyBrandingByBusinessId } from '~/lib/agency-branding';

import type { LinkValue } from '../../../_components/workspace-content/link-to-select';
import { getTeamAccountAccess } from '../../../_lib/role-access';
import { isWorkModuleEnabled } from '../../../_lib/server/account-modules';
import { createMeetingTranscriptsService } from '../../../_lib/server/meeting-transcripts.service';
import {
  loadRanklyClientImportOptions,
  loadRanklyImportSeedForClient,
  loadRanklyProjectForClient,
} from '../../../_lib/server/rankly-account-data';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import {
  notesVariantFromProfile,
  resolveWorkspaceProfile,
} from '../../../_lib/server/workspace-profile';
import {
  BUSINESS_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../../_lib/server/workspace-route-guard';
import { loadContextWorkspaceContent } from '../../../_lib/workspace-content/context-loader';
import type {
  DocListItem,
  LinkOption,
  NoteListItem,
} from '../../../_lib/workspace-content/types';
import { createSchedulingService } from '../../../scheduling/_lib/server/scheduling.service';
import type { ClientDetailOverviewSeed } from '../client-detail.types';
import { createClientsService } from './clients.service';

export type { ClientDetailOverviewSeed } from '../client-detail.types';

export const loadClientDetailPageData = cache(loadClientDetailPageDataImpl);

async function loadClientDetailPageDataImpl(
  accountSlug: string,
  clientId: string,
) {
  const workspace = await loadTeamWorkspace(accountSlug);
  if (!workspace?.account) notFound();

  redirectIfSpaceNotIn(workspace, accountSlug, BUSINESS_WORKSPACE_SPACE_TYPES);

  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (
    !access.canViewClients ||
    !isWorkModuleEnabled(workspace.moduleSettings, 'clients')
  ) {
    notFound();
  }

  const accountId = (workspace.account as { id: string }).id;
  const slug =
    (workspace.account as { slug?: string | null }).slug ?? accountSlug;
  const spaceType = (workspace.account as { space_type?: string }).space_type;
  const client = getSupabaseServerClient();
  const clientsService = createClientsService(client);
  const transcriptsService = createMeetingTranscriptsService(client);
  const schedulingService = createSchedulingService(client);
  const ranklyEnabled = isWorkModuleEnabled(workspace.moduleSettings, 'rankly');

  const clientPromise = clientsService.getClient({ accountId, clientId });

  const [
    clientRow,
    agencyBranding,
    workspaceContentResult,
    jobsResult,
    notesResult,
    meetingsResult,
    bookingsResult,
    ranklyResult,
  ] = await Promise.all([
    clientPromise,
    getAgencyBrandingByBusinessId(accountId),
    loadContextWorkspaceContent({
      accountId,
      spaceType,
      businessType: workspace.businessType,
      scope: { clientOrgId: clientId },
    }).catch((error) => {
      console.error('[client-detail] workspace content failed', error);
      return null;
    }),
    clientsService.getJobHistory({ accountId, clientId }).catch((error) => {
      console.error('[client-detail] job history failed', error);
      return [];
    }),
    clientsService.listNotes({ accountId, clientId }).catch((error) => {
      console.error('[client-detail] notes failed', error);
      return [];
    }),
    transcriptsService.listForClient({ accountId, clientId }).catch((error) => {
      console.error('[client-detail] meetings failed', error);
      return [];
    }),
    schedulingService
      .listUpcomingBookingsForClient(accountId, clientId)
      .catch((error) => {
        console.error('[client-detail] bookings failed', error);
        return [];
      }),
    ranklyEnabled
      ? Promise.all([
          loadRanklyProjectForClient(accountId, clientId),
          loadRanklyImportSeedForClient(accountId, clientId),
          loadRanklyClientImportOptions(accountId),
        ]).catch((error) => {
          console.error('[client-detail] rankly data failed', error);
          return [null, null, []] as const;
        })
      : Promise.resolve([null, null, []] as const),
  ]);

  if (!clientRow) notFound();

  const workspaceProfile = resolveWorkspaceProfile({
    space_type: spaceType,
    business_type: workspace.businessType,
  });

  let workspaceNotes: NoteListItem[] = [];
  let workspaceDocs: DocListItem[] = [];
  let notesTableAvailable = false;
  let docsTableAvailable = false;
  let linkOptions: LinkOption[] = [];
  let defaultLink: LinkValue = { type: 'client', id: clientId };

  if (workspaceContentResult) {
    workspaceNotes = workspaceContentResult.notes;
    workspaceDocs = workspaceContentResult.docs;
    notesTableAvailable = workspaceContentResult.notesTableAvailable;
    docsTableAvailable = workspaceContentResult.docsTableAvailable;
    linkOptions = workspaceContentResult.linkOptions;
    defaultLink = workspaceContentResult.defaultLink;
  }

  const [ranklyProject, ranklyImportSeed, ranklyClientImportOptions] =
    ranklyResult;

  const overviewSeed: ClientDetailOverviewSeed = {
    jobs: Array.isArray(jobsResult)
      ? (jobsResult as ClientDetailOverviewSeed['jobs'])
      : [],
    notes: (
      (notesResult ?? []) as Array<{
        id: string;
        note: string;
        created_at: string;
      }>
    ).map((note) => ({
      id: note.id,
      note: note.note,
      created_at: note.created_at,
    })),
    meetings: (
      (meetingsResult ?? []) as Array<{
        id: string;
        title: string;
        meetingDate: string | null;
        createdAt: string;
      }>
    ).map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      meetingDate: meeting.meetingDate,
      createdAt: meeting.createdAt,
    })),
    bookings: (
      (bookingsResult ?? []) as ClientDetailOverviewSeed['bookings']
    ).map((booking) => ({
      id: booking.id,
      startAt: booking.startAt,
      eventTypeName: booking.eventTypeName,
      inviteeName: booking.inviteeName,
    })),
  };

  const portalHref = agencyBranding?.slug
    ? pathsConfig.app.clientPortalHome.replace(
        '[clientSlug]',
        agencyBranding.slug,
      )
    : null;

  const clientRecord = clientRow as {
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  };
  const clientDisplayName =
    clientRecord.display_name?.trim() ||
    [clientRecord.first_name, clientRecord.last_name]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    'Client';

  return {
    accountId,
    accountSlug: slug,
    canEditClients: access.canEditClients,
    isContractorView: access.isContractor,
    client: clientRow,
    clientDisplayName,
    portalHref,
    clientsListHref: pathsConfig.app.accountClients.replace('[account]', slug),
    accountHomeHref: pathsConfig.app.accountHome.replace('[account]', slug),
    workspaceNotes,
    workspaceDocs,
    notesTableAvailable,
    docsTableAvailable,
    linkOptions,
    defaultLink,
    notesVariant: notesVariantFromProfile(workspaceProfile),
    ranklyEnabled,
    ranklyProject,
    ranklyImportSeed,
    ranklyClientImportOptions,
    overviewSeed,
  };
}
