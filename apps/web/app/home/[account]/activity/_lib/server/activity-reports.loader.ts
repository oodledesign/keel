import 'server-only';

import { cache } from 'react';

import { createTeamAccountsApi } from '@kit/team-accounts/api';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { createClientsService } from '~/home/[account]/clients/_lib/server/clients.service';
import { loadTeamWorkspace } from '~/home/[account]/_lib/server/team-account-workspace.loader';
import {
  activityAppGroupKey,
  aggregateActivityByApp,
  aggregateActivityByClient,
  aggregateActivityByMember,
  aggregateActivityByProject,
  filterActivityBlocksForReport,
  parseActivityView,
  resolveActivityDateRange,
  sumActiveDuration,
  type ActivityBlockListRow,
  type ActivityReportRow,
} from '~/lib/activity/activity-history';
import { getActivitySupabaseClient } from '~/lib/activity/activity-supabase';

export const ACTIVITY_REPORT_BLOCK_LIMIT = 5000;

export type ActivityProjectOption = {
  id: string;
  name: string;
};

export type ActivityClientOption = {
  id: string;
  name: string;
};

export type ActivityMemberOption = {
  id: string;
  name: string;
};

export type ActivityAppOption = {
  key: string;
  label: string;
};

export type ActivityReportsData = {
  accountId: string;
  accountSlug: string;
  userId: string;
  dateFrom: string;
  dateTo: string;
  view: 'mine' | 'team';
  canViewTeamActivity: boolean;
  totalDurationSeconds: number;
  blockCount: number;
  filters: {
    clientId: string | null;
    projectId: string | null;
    memberId: string | null;
    appKey: string | null;
  };
  byClient: ActivityReportRow[];
  byProject: ActivityReportRow[];
  byApp: ActivityReportRow[];
  byMember: ActivityReportRow[];
  projects: ActivityProjectOption[];
  clients: ActivityClientOption[];
  members: ActivityMemberOption[];
  apps: ActivityAppOption[];
};

type ActivityBlockRow = {
  id: string;
  user_id: string;
  app_name: string;
  bundle_id: string;
  domain: string | null;
  url: string | null;
  window_title: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  project_id: string | null;
  client_id: string | null;
  confidence_score: number | null;
  is_confirmed: boolean;
  is_excluded: boolean;
  projects?: { id: string; name: string | null; title: string | null } | null;
  clients?: { id: string; display_name: string | null } | null;
};

type MemberRow = {
  user_id?: string;
  name?: string | null;
  email?: string | null;
};

function projectLabel(project: ActivityBlockRow['projects']): string | null {
  if (!project) {
    return null;
  }

  return project.title?.trim() || project.name?.trim() || null;
}

function clientLabel(client: ActivityBlockRow['clients']): string | null {
  if (!client) {
    return null;
  }

  return client.display_name?.trim() || null;
}

function mapMemberNames(rows: MemberRow[]): Map<string, string> {
  const names = new Map<string, string>();

  for (const row of rows) {
    const memberId = row.user_id?.trim();
    if (!memberId) continue;

    const label = row.name?.trim() || row.email?.trim() || memberId.slice(0, 8);
    names.set(memberId, label);
  }

  return names;
}

function mapBlockRow(
  row: ActivityBlockRow,
  memberNames: Map<string, string>,
): ActivityBlockListRow {
  return {
    id: row.id,
    userId: row.user_id,
    userName: memberNames.get(row.user_id) ?? null,
    appName: row.app_name,
    bundleId: row.bundle_id,
    domain: row.domain,
    url: row.url,
    windowTitle: row.window_title,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds,
    projectId: row.project_id,
    projectName: projectLabel(row.projects),
    clientId: row.client_id,
    clientName: clientLabel(row.clients),
    confidenceScore:
      row.confidence_score == null ? null : Number(row.confidence_score),
    isConfirmed: row.is_confirmed,
    isExcluded: row.is_excluded,
  };
}

function mapProjectOptions(
  rows: Array<{
    id: string;
    name: string | null;
    title: string | null;
    project_type?: string | null;
  }>,
): ActivityProjectOption[] {
  return rows
    .filter((row) => row.project_type === 'delivery')
    .map((row) => ({
      id: row.id,
      name: row.title?.trim() || row.name?.trim() || 'Untitled project',
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function mapClientOptions(
  rows: Array<{
    id: string;
    display_name?: string | null;
    company_name?: string | null;
  }>,
): ActivityClientOption[] {
  return rows
    .map((row) => ({
      id: row.id,
      name:
        row.display_name?.trim() ||
        row.company_name?.trim() ||
        'Unnamed client',
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function mapAppOptions(blocks: ActivityBlockListRow[]): ActivityAppOption[] {
  const options = new Map<string, string>();

  for (const block of blocks) {
    const key = activityAppGroupKey(block);
    if (options.has(key)) continue;

    const domain = block.domain?.trim();
    options.set(key, domain || block.appName);
  }

  return [...options.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function mapMemberOptions(
  memberNames: Map<string, string>,
): ActivityMemberOption[] {
  return [...memberNames.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export const loadActivityReportsData = cache(loadActivityReportsDataImpl);

async function loadActivityReportsDataImpl(
  accountSlug: string,
  dateInput?: {
    from?: string | null;
    to?: string | null;
    range?: string | null;
  },
  viewInput?: string | null,
  filterInput?: {
    client?: string | null;
    project?: string | null;
    member?: string | null;
    app?: string | null;
  },
): Promise<ActivityReportsData> {
  const workspace = await loadTeamWorkspace(accountSlug);
  const accountId = workspace.account.id as string;
  const userId = workspace.user.id;
  const client = getSupabaseServerClient();
  const activityClient = getActivitySupabaseClient();
  const teamAccountsApi = createTeamAccountsApi(client);

  const dateRange = resolveActivityDateRange({
    from: dateInput?.from,
    to: dateInput?.to,
    range: dateInput?.range,
  });
  const view = parseActivityView(viewInput);

  const blocksSelect = `
        id,
        user_id,
        app_name,
        bundle_id,
        domain,
        url,
        window_title,
        started_at,
        ended_at,
        duration_seconds,
        project_id,
        client_id,
        confidence_score,
        is_confirmed,
        is_excluded,
        projects:project_id ( id, name, title ),
        clients:client_id ( id, display_name )
      `;

  const fetchActivityBlocks = (filterUserId?: string) => {
    let query = activityClient
      .from('activity_blocks')
      .select(blocksSelect)
      .eq('account_id', accountId)
      .gte('started_at', dateRange.rangeStart)
      .lte('started_at', dateRange.rangeEnd)
      .order('started_at', { ascending: false })
      .limit(ACTIVITY_REPORT_BLOCK_LIMIT);

    if (filterUserId) {
      query = query.eq('user_id', filterUserId);
    }

    return query;
  };

  const [
    canViewTeamActivity,
    membersResult,
    projectsResult,
    clientsResult,
    mineBlocksResult,
    teamBlocksResult,
  ] = await Promise.all([
    teamAccountsApi.hasPermission({
      accountId,
      userId,
      permission: 'activity.view_team' as never,
    }),
    client.rpc('get_account_members', { account_slug: accountSlug }),
    client
      .from('projects')
      .select('id, name, title, project_type')
      .eq('account_id', accountId)
      .order('name', { ascending: true })
      .limit(200),
    createClientsService(client).listClients({
      accountId,
      page: 1,
      pageSize: 100,
    }),
    fetchActivityBlocks(userId),
    view === 'team'
      ? fetchActivityBlocks()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (membersResult.error) {
    throw new Error(membersResult.error.message);
  }

  if (mineBlocksResult.error) {
    throw new Error(mineBlocksResult.error.message);
  }

  if (teamBlocksResult.error) {
    throw new Error(teamBlocksResult.error.message);
  }

  const memberNames = mapMemberNames((membersResult.data ?? []) as MemberRow[]);
  const effectiveView =
    view === 'team' && canViewTeamActivity ? 'team' : 'mine';

  const blockRows =
    effectiveView === 'team'
      ? (teamBlocksResult.data ?? [])
      : (mineBlocksResult.data ?? []);

  const allBlocks = ((blockRows ?? []) as unknown as ActivityBlockRow[]).map(
    (row) => mapBlockRow(row, memberNames),
  );

  const filters = {
    clientId: filterInput?.client?.trim() || null,
    projectId: filterInput?.project?.trim() || null,
    memberId: filterInput?.member?.trim() || null,
    appKey: filterInput?.app?.trim() || null,
  };

  const filteredBlocks = filterActivityBlocksForReport(allBlocks, filters);

  return {
    accountId,
    accountSlug,
    userId,
    dateFrom: dateRange.dateFrom,
    dateTo: dateRange.dateTo,
    view: effectiveView,
    canViewTeamActivity,
    totalDurationSeconds: sumActiveDuration(filteredBlocks),
    blockCount: filteredBlocks.length,
    filters,
    byClient: aggregateActivityByClient(filteredBlocks),
    byProject: aggregateActivityByProject(filteredBlocks),
    byApp: aggregateActivityByApp(filteredBlocks),
    byMember: aggregateActivityByMember(filteredBlocks),
    projects: mapProjectOptions(
      (projectsResult.data ?? []) as unknown as Array<{
        id: string;
        name: string | null;
        title: string | null;
        project_type?: string | null;
      }>,
    ),
    clients: mapClientOptions(clientsResult.data ?? []),
    members: mapMemberOptions(memberNames),
    apps: mapAppOptions(allBlocks.filter((block) => !block.isExcluded)),
  };
}
