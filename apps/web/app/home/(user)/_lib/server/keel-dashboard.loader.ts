import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

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

function mapTaskStatus(status: string | null | undefined): 'pending' | 'in_progress' | 'completed' {
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

// ─── Main loader ─────────────────────────────────────────────────────

export const loadKeelDashboard = cache(async (): Promise<KeelDashboardData> => {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();
  const userId = user.id;
  const today = todayIso();
  const weekEnd = weekFromNowIso();

  const displayName =
    toFirstName(
      (user.user_metadata as Record<string, unknown>)?.display_name as string ??
      (user.user_metadata as Record<string, unknown>)?.name as string,
    ) ||
    toFirstName(user.email?.split('@')[0]) ||
    'there';

  // Run all queries in parallel
  const [
    todayTasksResult,
    pipelineDealsResult,
    businessesResult,
    businessProjectsResult,
    businessTasksResult,
    businessTicketsResult,
    businessDealsResult,
    pipelineSnapshotResult,
    lifeTasksResult,
    recentTasksResult,
  ] = await Promise.all([
    // Tasks due today for current user
    client
      .from('tasks')
      .select(
        'id, title, status, priority, due_date, projects(name, businesses(name, colour)), areas(name, colour)',
      )
      .eq('user_id', userId)
      .eq('due_date', today)
      .not('status', 'eq', 'done')
      .order('priority', { ascending: false })
      .limit(20),

    // Pipeline deals with next_action_date = today
    client
      .from('pipeline_deals')
      .select('id, contact_name, company_name, next_action, businesses(name, colour)')
      .eq('next_action_date', today)
      .not('stage', 'in', '("won","lost")')
      .limit(10),

    // All businesses owned by user
    client
      .from('businesses')
      .select('id, name, colour')
      .eq('owner_id', userId),

    // Active projects per business
    client
      .from('projects')
      .select('id, business_id')
      .not('status', 'in', '("completed","cancelled","archived")'),

    // Open tasks per business (via project)
    client
      .from('tasks')
      .select('id, projects!inner(business_id)')
      .not('status', 'eq', 'done'),

    // Open support tickets per business
    client
      .from('support_tickets')
      .select('id, client_orgs!inner(business_id)')
      .not('status', 'in', '("resolved","closed")'),

    // Active pipeline deals per business (for counts + value)
    client
      .from('pipeline_deals')
      .select('id, business_id, value, stage')
      .not('stage', 'in', '("won","lost")'),

    // Pipeline deals for snapshot (all stages)
    client
      .from('pipeline_deals')
      .select('id, stage'),

    // Life tasks (areas not linked to a business, due this week)
    client
      .from('tasks')
      .select(
        'id, title, status, priority, due_date, areas!inner(name, colour, group_id, groups(name, type))',
      )
      .eq('user_id', userId)
      .is('project_id', null)
      .lte('due_date', weekEnd)
      .not('status', 'eq', 'done')
      .order('due_date', { ascending: true })
      .limit(30),

    // Recent completed tasks for activity feed
    client
      .from('tasks')
      .select('id, title, status, updated_at')
      .eq('user_id', userId)
      .eq('status', 'done')
      .order('updated_at', { ascending: false })
      .limit(5),
  ]);

  // ─── Transform: Today's tasks ──────────────────────────────────
  const todayTasks: DashboardTask[] = (todayTasksResult.data ?? []).map(
    (row: any) => ({
      id: row.id,
      title: row.title ?? 'Untitled',
      status: mapTaskStatus(row.status),
      priority: row.priority ?? 'medium',
      dueDate: row.due_date,
      projectName: row.projects?.name ?? null,
      areaName: row.areas?.name ?? null,
      areaColor: row.areas?.colour ?? null,
      businessName: row.projects?.businesses?.name ?? null,
    }),
  );

  // ─── Transform: Pipeline deals today ───────────────────────────
  const pipelineDealsToday: PipelineDealToday[] = (
    pipelineDealsResult.data ?? []
  ).map((row: any) => ({
    id: row.id,
    contactName: row.contact_name ?? '',
    companyName: row.company_name ?? '',
    nextAction: row.next_action ?? '',
    businessName: row.businesses?.name ?? null,
    businessColor: row.businesses?.colour ?? null,
  }));

  // ─── Transform: Business overviews ─────────────────────────────
  const businessRows = businessesResult.data ?? [];

  const businesses: BusinessOverview[] = businessRows.map((biz: any) => {
    const bizId = biz.id;

    const activeProjects = (businessProjectsResult.data ?? []).filter(
      (p: any) => p.business_id === bizId,
    ).length;

    const openTasks = (businessTasksResult.data ?? []).filter(
      (t: any) => t.projects?.business_id === bizId,
    ).length;

    const openTickets = (businessTicketsResult.data ?? []).filter(
      (t: any) => t.client_orgs?.business_id === bizId,
    ).length;

    const bizDeals = (businessDealsResult.data ?? []).filter(
      (d: any) => d.business_id === bizId,
    );
    const activeDeals = bizDeals.length;
    const dealValue = bizDeals.reduce(
      (sum: number, d: any) => sum + (d.value ?? 0),
      0,
    );

    return {
      businessId: bizId,
      businessName: biz.name ?? 'Unknown',
      businessColor: biz.colour ?? null,
      activeProjects,
      openTasks,
      openTickets,
      activeDeals,
      dealValue,
    };
  });

  // ─── Transform: Pipeline snapshot ──────────────────────────────
  const stageCounts = new Map<string, number>();
  for (const deal of pipelineSnapshotResult.data ?? []) {
    const stage = (deal as any).stage ?? 'lead';
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

  // ─── Transform: Life areas ─────────────────────────────────────
  const lifeMap = new Map<string, { color: string | null; tasks: DashboardTask[] }>();

  for (const row of lifeTasksResult.data ?? []) {
    const r = row as any;
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

  // ─── Transform: Recent activity ────────────────────────────────
  const recentActivity: ActivityItem[] = (recentTasksResult.data ?? []).map(
    (row: any) => ({
      id: row.id,
      description: `Completed "${row.title}"`,
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
