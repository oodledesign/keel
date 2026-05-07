import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  loadBusinessIdsForTeamAccount,
  loadUserWorkspaceAccounts,
} from '~/home/_lib/server/workspace-scope';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

// ─── Types ───────────────────────────────────────────────────────────

export type DashboardTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  projectName: string | null;
  areaName: string | null;
  areaColor: string | null;
  businessName: string | null;
};

export type PipelineDealToday = {
  id: string;
  contactName: string;
  companyName: string;
  nextAction: string;
  businessName: string | null;
  businessColor: string | null;
};

export type BusinessOverview = {
  businessId: string;
  businessName: string;
  businessColor: string | null;
  activeProjects: number;
  openTasks: number;
  openTickets: number;
  activeDeals: number;
  dealValue: number;
};

export type PipelineStageCount = {
  stage: string;
  count: number;
};

export type LifeAreaGroup = {
  areaName: string;
  areaColor: string | null;
  tasks: DashboardTask[];
};

export type ActivityItem = {
  id: string;
  description: string;
  timestamp: string;
  type: string;
};

export type KeelDashboardData = {
  userName: string;
  todayTasks: DashboardTask[];
  pipelineDealsToday: PipelineDealToday[];
  businesses: BusinessOverview[];
  pipelineSnapshot: PipelineStageCount[];
  lifeAreas: LifeAreaGroup[];
  recentActivity: ActivityItem[];
};

// ─── Helpers ─────────────────────────────────────────────────────────

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function weekFromNowIso() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

function toFirstName(raw: string | null | undefined): string {
  if (!raw) return 'there';
  const base = raw.split(' ')[0] ?? raw;
  if (!base) return 'there';
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function mapTaskStatus(
  status: string | null | undefined,
): 'pending' | 'in_progress' | 'completed' {
  switch ((status ?? '').toLowerCase()) {
    case 'todo':
      return 'pending';
    case 'in_progress':
      return 'in_progress';
    case 'done':
    case 'cancelled':
      return 'completed';
    default:
      return 'pending';
  }
}

function buildPipelineOrFilter(
  workspaceIds: string[],
  businessIds: string[],
): string | null {
  const parts: string[] = [];
  if (workspaceIds.length > 0) {
    parts.push(`account_id.in.(${workspaceIds.join(',')})`);
  }
  if (businessIds.length > 0) {
    parts.push(`business_id.in.(${businessIds.join(',')})`);
  }
  if (parts.length === 0) return null;
  return parts.length === 1 ? parts[0]! : parts.join(',');
}

async function countOpenTasksForAccount(
  client: ReturnType<typeof getSupabaseServerClient>,
  userId: string,
  accountId: string,
): Promise<number> {
  const [{ data: projectsData }, { data: clientsData }] = await Promise.all([
    client.from('projects').select('id').eq('account_id', accountId),
    client.from('clients').select('id').eq('account_id', accountId),
  ]);
  const projectIds = (projectsData ?? []).map((p: { id: string }) => p.id);
  const clientIds = (clientsData ?? []).map((c: { id: string }) => c.id);
  if (projectIds.length === 0 && clientIds.length === 0) return 0;

  let q = client
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('status', 'eq', 'done');

  if (projectIds.length > 0 && clientIds.length > 0) {
    q = q.or(
      `project_id.in.(${projectIds.join(',')}),client_id.in.(${clientIds.join(',')})`,
    );
  } else if (projectIds.length > 0) {
    q = q.in('project_id', projectIds);
  } else {
    q = q.in('client_id', clientIds);
  }
  const { count, error } = await q;
  if (error) return 0;
  return count ?? 0;
}

// ─── Main loader ─────────────────────────────────────────────────────

export const loadKeelDashboard = cache(async (): Promise<KeelDashboardData> => {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();
  const userId = user.id;
  const today = todayIso();
  const weekEnd = weekFromNowIso();

  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const displayNameRaw =
    (typeof meta?.display_name === 'string' && meta.display_name.trim()) ||
    (typeof meta?.name === 'string' && meta.name.trim()) ||
    user.email?.split('@')[0] ||
    '';
  const displayName = toFirstName(displayNameRaw) || 'there';

  const workspaces = await loadUserWorkspaceAccounts(client, userId);
  const workspaceIds = workspaces.map((w) => w.id);

  const allBizIds = new Set<string>();
  const bizIdsByWorkspace = new Map<string, string[]>();
  for (const w of workspaces) {
    const bids = await loadBusinessIdsForTeamAccount(client, w.id);
    bizIdsByWorkspace.set(w.id, bids);
    bids.forEach((id) => allBizIds.add(id));
  }

  const { data: ownedBizRows } = await client
    .from('businesses')
    .select('id')
    .eq('owner_id', userId);
  for (const row of ownedBizRows ?? []) {
    allBizIds.add((row as { id: string }).id);
  }

  const pipelineOr = buildPipelineOrFilter(workspaceIds, [...allBizIds]);

  const todayTasksQuery = client
    .from('tasks')
    .select(
      'id, title, status, priority, due_date, project_id, client_id, projects(name, businesses(name, colour), accounts(name)), areas(name, colour)',
    )
    .eq('user_id', userId)
    .eq('due_date', today)
    .not('status', 'eq', 'done')
    .order('priority', { ascending: false })
    .limit(20);

  let pipelineDealsTodayQuery = client
    .from('pipeline_deals')
    .select(
      'id, contact_name, company_name, next_action, business_id, account_id, businesses(name, colour), accounts(name)',
    )
    .eq('next_action_date', today)
    .not('stage', 'in', '("won","lost")')
    .limit(10);

  let pipelineSnapshotQuery = client.from('pipeline_deals').select('id, stage');

  let activeDealsQuery = client
    .from('pipeline_deals')
    .select('id, business_id, account_id, value, stage')
    .not('stage', 'in', '("won","lost")');

  if (pipelineOr) {
    pipelineDealsTodayQuery = pipelineDealsTodayQuery.or(pipelineOr);
    pipelineSnapshotQuery = pipelineSnapshotQuery.or(pipelineOr);
    activeDealsQuery = activeDealsQuery.or(pipelineOr);
  } else {
    pipelineDealsTodayQuery = pipelineDealsTodayQuery.limit(0);
    pipelineSnapshotQuery = pipelineSnapshotQuery.limit(0);
    activeDealsQuery = activeDealsQuery.limit(0);
  }

  const [
    todayTasksResult,
    pipelineDealsResult,
    pipelineSnapshotResult,
    activeDealsAllResult,
    lifeTasksResult,
    recentTasksResult,
  ] = await Promise.all([
    todayTasksQuery,
    pipelineDealsTodayQuery,
    pipelineSnapshotQuery,
    activeDealsQuery,
    client
      .from('tasks')
      .select(
        'id, title, status, priority, due_date, areas(name, colour, group_id, groups(name, type))',
      )
      .eq('user_id', userId)
      .is('project_id', null)
      .is('client_id', null)
      .lte('due_date', weekEnd)
      .not('status', 'eq', 'done')
      .order('due_date', { ascending: true })
      .limit(30),
    client
      .from('tasks')
      .select('id, title, status, updated_at')
      .eq('user_id', userId)
      .eq('status', 'done')
      .order('updated_at', { ascending: false })
      .limit(5),
  ]);

  type TodayTaskRow = {
    id: string;
    title?: string | null;
    status?: string | null;
    priority?: string | null;
    due_date?: string | null;
    projects?: {
      name?: string | null;
      businesses?: { name?: string | null } | null;
      accounts?: { name?: string | null } | null;
    } | null;
    areas?: { name?: string | null; colour?: string | null } | null;
  };

  const todayTasks: DashboardTask[] = (todayTasksResult.data ?? []).map(
    (row: TodayTaskRow) => ({
      id: row.id,
      title: row.title ?? 'Untitled',
      status: mapTaskStatus(row.status),
      priority: row.priority ?? 'medium',
      dueDate: row.due_date,
      projectName: row.projects?.name ?? null,
      areaName: row.areas?.name ?? null,
      areaColor: row.areas?.colour ?? null,
      businessName:
        row.projects?.businesses?.name ??
        row.projects?.accounts?.name ??
        null,
    }),
  );

  type PipelineDealRow = {
    id: string;
    contact_name?: string | null;
    company_name?: string | null;
    next_action?: string | null;
    businesses?: { name?: string | null; colour?: string | null } | null;
    accounts?: { name?: string | null } | null;
  };

  const pipelineDealsToday: PipelineDealToday[] = (
    pipelineDealsResult.data ?? []
  ).map((row: PipelineDealRow) => ({
    id: row.id,
    contactName: row.contact_name ?? '',
    companyName: row.company_name ?? '',
    nextAction: row.next_action ?? '',
    businessName:
      row.businesses?.name ?? row.accounts?.name ?? null,
    businessColor: row.businesses?.colour ?? null,
  }));

  type DealOverviewRow = {
    account_id?: string | null;
    business_id?: string | null;
    value?: number | string | null;
  };

  const allDealsForOverview = (activeDealsAllResult.data ??
    []) as DealOverviewRow[];

  const businesses: BusinessOverview[] = await Promise.all(
    workspaces.map(async (w) => {
      const bids = new Set(bizIdsByWorkspace.get(w.id) ?? []);

      const [{ count: projCount }, openTasks, ticketCount] = await Promise.all([
        client
          .from('projects')
          .select('id', { count: 'exact', head: true })
          .eq('account_id', w.id),
        countOpenTasksForAccount(client, userId, w.id),
        countSupportTicketsForWorkspace(client, bids),
      ]);

      const dealsHere = allDealsForOverview.filter(
        (d) =>
          d.account_id === w.id ||
          (d.business_id && bids.has(String(d.business_id))),
      );
      const activeDeals = dealsHere.length;
      const dealValue = dealsHere.reduce(
        (sum, d) => sum + (Number(d.value) || 0),
        0,
      );

      let businessColor: string | null = null;
      if (bids.size > 0) {
        const { data: colourRow } = await client
          .from('businesses')
          .select('colour')
          .in('id', [...bids])
          .limit(1)
          .maybeSingle();
        businessColor =
          (colourRow as { colour?: string | null } | null)?.colour ?? null;
      }

      return {
        businessId: w.id,
        businessName: w.name ?? w.slug ?? 'Workspace',
        businessColor,
        activeProjects: projCount ?? 0,
        openTasks,
        openTickets: ticketCount,
        activeDeals,
        dealValue,
      };
    }),
  );

  const stageCounts = new Map<string, number>();
  for (const deal of pipelineSnapshotResult.data ?? []) {
    const stage =
      (deal as { stage?: string | null }).stage ?? 'lead';
    stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + 1);
  }

  const ORDERED_STAGES = [
    'lead',
    'qualified',
    'call_booked',
    'proposal_sent',
    'negotiation',
    'won',
    'lost',
  ];
  const pipelineSnapshot: PipelineStageCount[] = ORDERED_STAGES.map(
    (stage) => ({
      stage,
      count: stageCounts.get(stage) ?? 0,
    }),
  );

  const lifeMap = new Map<
    string,
    { color: string | null; tasks: DashboardTask[] }
  >();

  type LifeTaskRow = {
    id: string;
    title?: string | null;
    status?: string | null;
    priority?: string | null;
    due_date?: string | null;
    areas?: {
      name?: string | null;
      colour?: string | null;
      groups?: { name?: string | null } | null;
    } | null;
  };

  for (const row of lifeTasksResult.data ?? []) {
    const r = row as LifeTaskRow;
    const areaName = r.areas?.groups?.name ?? r.areas?.name ?? 'Personal';
    const color = r.areas?.colour ?? null;

    if (!lifeMap.has(areaName)) {
      lifeMap.set(areaName, { color, tasks: [] });
    }

    lifeMap.get(areaName)!.tasks.push({
      id: r.id,
      title: r.title ?? 'Untitled',
      status: mapTaskStatus(r.status),
      priority: r.priority ?? 'medium',
      dueDate: r.due_date,
      projectName: null,
      areaName,
      areaColor: color,
      businessName: null,
    });
  }

  const lifeAreas: LifeAreaGroup[] = Array.from(lifeMap.entries()).map(
    ([name, data]) => ({
      areaName: name,
      areaColor: data.color,
      tasks: data.tasks,
    }),
  );

  type RecentTaskRow = {
    id: string;
    title?: string | null;
    updated_at?: string | null;
  };

  const recentActivity: ActivityItem[] = (recentTasksResult.data ?? []).map(
    (row: RecentTaskRow) => ({
      id: row.id,
      description: `Completed "${row.title ?? 'Task'}"`,
      timestamp: row.updated_at
        ? new Date(row.updated_at).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
          })
        : '',
      type: 'task_completed',
    }),
  );

  return {
    userName: displayName,
    todayTasks,
    pipelineDealsToday,
    businesses,
    pipelineSnapshot,
    lifeAreas,
    recentActivity,
  };
});

async function countSupportTicketsForWorkspace(
  client: ReturnType<typeof getSupabaseServerClient>,
  businessIds: Set<string>,
): Promise<number> {
  if (businessIds.size === 0) return 0;
  try {
    const { data: orgRows, error: orgErr } = await client
      .from('client_orgs')
      .select('id')
      .in('business_id', [...businessIds]);
    if (orgErr) return 0;
    const orgIds = (orgRows ?? []).map((r: { id: string }) => r.id);
    if (orgIds.length === 0) return 0;

    const { count, error } = await client
      .from('support_tickets')
      .select('id', { count: 'exact', head: true })
      .not('status', 'in', '("resolved","closed")')
      .in('client_org_id', orgIds);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}
