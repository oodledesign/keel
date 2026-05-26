import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  isCalendarOverdueYmd,
  parseDueDateParts,
  todayLocalYmd,
  toIsoDateString,
} from '~/home/_lib/due-date-ymd';
import {
  loadBusinessIdsForTeamAccount,
  loadUserWorkspaceAccounts,
  type WorkspaceAccountRow,
} from '~/home/_lib/server/workspace-scope';
import { normalizeSpaceType } from '~/home/[account]/_lib/server/account-modules';
import { workspaceColorForSpaceType } from '~/home/(user)/_lib/workspace-accent';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import type { PersonalNavWorkspace } from '~/config/personal-account-navigation.config';

// ─── Types ───────────────────────────────────────────────────────────

export type PersonalDashboardTask = {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate: string | null;
  dueLabel: string;
  isOverdue: boolean;
  workspaceName: string;
  workspaceSlug: string | null;
  workspaceColor: string;
};

export type PersonalCalendarEvent = {
  id: string;
  title: string;
  timeLabel: string;
  workspaceName: string;
  workspaceColor: string;
};

export type WorkspaceOverviewStat = {
  label: string;
  value: string;
};

export type WorkspaceOverviewCard = {
  id: string;
  name: string;
  slug: string;
  spaceType: ReturnType<typeof normalizeSpaceType>;
  color: string;
  pictureUrl: string | null;
  stats: WorkspaceOverviewStat[];
};

export type KeelDashboardData = {
  userName: string;
  dateLabel: string;
  workspaces: PersonalNavWorkspace[];
  todaysFocus: PersonalDashboardTask[];
  upcoming: PersonalDashboardTask[];
  myDayEvents: PersonalCalendarEvent[];
  workspaceOverview: WorkspaceOverviewCard[];
};

// ─── Helpers ─────────────────────────────────────────────────────────

function toFirstName(raw: string | null | undefined): string {
  if (!raw) return 'there';
  const base = raw.split(' ')[0] ?? raw;
  if (!base) return 'there';
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function formatDateLabel(now = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);
}

function formatDueLabel(due: string | null, isOverdue: boolean): string {
  if (!due) return '';
  const today = todayLocalYmd();
  if (due === today) return 'Today';
  if (isOverdue) {
    const p = parseDueDateParts(due);
    if (!p) return 'Overdue';
    const d = new Date(p.y, p.m - 1, p.d, 12, 0, 0, 0);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
  const p = parseDueDateParts(due);
  if (!p) return '';
  const d = new Date(p.y, p.m - 1, p.d, 12, 0, 0, 0);
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function mapPriority(raw: string | null | undefined): PersonalDashboardTask['priority'] {
  const p = (raw ?? 'medium').toLowerCase();
  if (p === 'low' || p === 'high' || p === 'urgent') return p;
  return 'medium';
}

function formatTimeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' });
}

function weekFromNowIso() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

function localDayBounds(now = new Date()) {
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  );
  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );
  return { start: start.toISOString(), end: end.toISOString() };
}

type TaskRow = {
  id: string;
  title?: string | null;
  status?: string | null;
  priority?: string | null;
  due_date?: string | null;
  project_id?: string | null;
  client_id?: string | null;
};

type ProjectRow = {
  id: string;
  name?: string | null;
  account_id?: string | null;
  businesses?: { colour?: string | null } | null;
};

type ClientRow = {
  id: string;
  account_id?: string | null;
};

async function mapTasksToDashboard(
  client: ReturnType<typeof getSupabaseServerClient>,
  rows: TaskRow[],
  workspaceById: Map<string, WorkspaceAccountRow>,
): Promise<PersonalDashboardTask[]> {
  const projectIds = [
    ...new Set(rows.map((r) => r.project_id).filter(Boolean)),
  ] as string[];
  const clientIds = [
    ...new Set(rows.map((r) => r.client_id).filter(Boolean)),
  ] as string[];

  const [projectsResult, clientsResult] = await Promise.all([
    projectIds.length > 0
      ? client
          .from('projects')
          .select('id, name, account_id, businesses(colour)')
          .in('id', projectIds)
      : Promise.resolve({ data: [] as ProjectRow[] }),
    clientIds.length > 0
      ? client.from('clients').select('id, account_id').in('id', clientIds)
      : Promise.resolve({ data: [] as ClientRow[] }),
  ]);

  const projects = new Map<string, ProjectRow>();
  for (const p of (projectsResult.data ?? []) as ProjectRow[]) {
    projects.set(p.id, p);
  }
  const clients = new Map<string, ClientRow>();
  for (const c of (clientsResult.data ?? []) as ClientRow[]) {
    clients.set(c.id, c);
  }

  const today = todayLocalYmd();

  return rows.map((row) => {
    let accountId: string | null = null;
    let accent: string | null = null;

    if (row.project_id) {
      const p = projects.get(row.project_id);
      accountId = p?.account_id ?? null;
      accent = p?.businesses?.colour ?? null;
    } else if (row.client_id) {
      accountId = clients.get(row.client_id)?.account_id ?? null;
    }

    const ws = accountId ? workspaceById.get(accountId) : null;
    const due = toIsoDateString(row.due_date);
    const overdue = isCalendarOverdueYmd(due);
    const isPersonal = !ws;

    return {
      id: row.id,
      title: row.title?.trim() || 'Untitled',
      priority: mapPriority(row.priority),
      dueDate: due,
      dueLabel: formatDueLabel(due, overdue),
      isOverdue: overdue,
      workspaceName: ws?.name?.trim() || ws?.slug || 'Personal',
      workspaceSlug: ws?.slug ?? null,
      workspaceColor: isPersonal
        ? '#7C3AED'
        : accent ?? workspaceColorForSpaceType(ws?.space_type ?? 'work'),
    };
  });
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

  const { count } = await q;
  return count ?? 0;
}

async function buildWorkspaceOverview(
  client: ReturnType<typeof getSupabaseServerClient>,
  userId: string,
  workspaces: WorkspaceAccountRow[],
  bizIdsByWorkspace: Map<string, string[]>,
): Promise<WorkspaceOverviewCard[]> {
  const weekEnd = weekFromNowIso();
  const { start: todayStart, end: todayEnd } = localDayBounds();

  return Promise.all(
    workspaces.map(async (w) => {
      const spaceType = normalizeSpaceType(w.space_type);
      const color = workspaceColorForSpaceType(spaceType);
      const name = w.name?.trim() || w.slug || 'Workspace';
      const slug = w.slug ?? '';
      const stats: WorkspaceOverviewStat[] = [];

      if (spaceType === 'work') {
        const bids = bizIdsByWorkspace.get(w.id) ?? [];
        const pipelineOr =
          bids.length > 0
            ? `account_id.eq.${w.id},business_id.in.(${bids.join(',')})`
            : `account_id.eq.${w.id}`;

        const [
          { count: jobCount },
          openTasks,
          { data: deals },
        ] = await Promise.all([
          client
            .from('jobs')
            .select('id', { count: 'exact', head: true })
            .eq('account_id', w.id)
            .not('status', 'in', '("completed","cancelled")'),
          countOpenTasksForAccount(client, userId, w.id),
          client
            .from('pipeline_deals')
            .select('value')
            .or(pipelineOr)
            .not('stage', 'in', '("won","lost")'),
        ]);

        const pipelineValue = (deals ?? []).reduce(
          (sum, d) => sum + (Number((d as { value?: number }).value) || 0),
          0,
        );

        stats.push(
          { label: 'Active projects', value: String(jobCount ?? 0) },
          { label: 'Open tasks', value: String(openTasks) },
          {
            label: 'Pipeline value',
            value: new Intl.NumberFormat('en-GB', {
              style: 'currency',
              currency: 'GBP',
              maximumFractionDigits: 0,
            }).format(pipelineValue),
          },
        );
      } else if (spaceType === 'property') {
        const [
          { count: propertyCount },
          { count: activeCount },
          { count: maintenanceCount },
        ] = await Promise.all([
          client
            .from('properties')
            .select('id', { count: 'exact', head: true })
            .eq('account_id', w.id),
          client
            .from('properties')
            .select('id', { count: 'exact', head: true })
            .eq('account_id', w.id)
            .eq('status', 'active'),
          client
            .from('properties')
            .select('id', { count: 'exact', head: true })
            .eq('account_id', w.id)
            .eq('status', 'maintenance'),
        ]);

        stats.push(
          { label: 'Properties', value: String(propertyCount ?? 0) },
          { label: 'Active tenancies', value: String(activeCount ?? 0) },
          { label: 'Open maintenance', value: String(maintenanceCount ?? 0) },
        );
      } else if (spaceType === 'family') {
        const openTasks = await countOpenTasksForAccount(client, userId, w.id);
        const { count: eventCount } = await client
          .from('job_events')
          .select('id', { count: 'exact', head: true })
          .eq('account_id', w.id)
          .gte('scheduled_start_at', todayStart)
          .lte('scheduled_start_at', `${weekEnd}T23:59:59.999Z`);

        stats.push(
          { label: 'Open tasks', value: String(openTasks) },
          {
            label: 'Upcoming events',
            value: String(eventCount ?? 0),
          },
        );
      } else {
        const openTasks = await countOpenTasksForAccount(client, userId, w.id);
        const { data: nextEvent } = await client
          .from('job_events')
          .select('scheduled_start_at')
          .eq('account_id', w.id)
          .gte('scheduled_start_at', todayStart)
          .order('scheduled_start_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        const nextSession = (nextEvent as { scheduled_start_at?: string } | null)
          ?.scheduled_start_at;
        let nextLabel = '—';
        if (nextSession) {
          const d = new Date(nextSession);
          if (!Number.isNaN(d.getTime())) {
            nextLabel = d.toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
            });
          }
        }

        stats.push(
          { label: 'Open tasks', value: String(openTasks) },
          { label: 'Next session', value: nextLabel },
        );
      }

      return {
        id: w.id,
        name,
        slug,
        spaceType,
        color,
        pictureUrl: w.picture_url ?? null,
        stats: stats.slice(0, 4),
      };
    }),
  );
}

// ─── Main loader ─────────────────────────────────────────────────────

export const loadKeelDashboard = cache(async (): Promise<KeelDashboardData> => {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();
  const userId = user.id;
  const today = todayLocalYmd();
  const { start: todayStart, end: todayEnd } = localDayBounds();

  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const displayNameRaw =
    (typeof meta?.display_name === 'string' && meta.display_name.trim()) ||
    (typeof meta?.name === 'string' && meta.name.trim()) ||
    user.email?.split('@')[0] ||
    '';
  const userName = toFirstName(displayNameRaw) || 'there';

  const workspaceRows = await loadUserWorkspaceAccounts(client, userId);
  const workspaceById = new Map(workspaceRows.map((w) => [w.id, w]));

  const workspaces: PersonalNavWorkspace[] = workspaceRows
    .filter((w) => w.slug)
    .map((w) => ({
      id: w.id,
      label: w.name?.trim() || w.slug!,
      slug: w.slug!,
      pictureUrl: w.picture_url ?? null,
      spaceType: w.space_type,
    }));

  const bizIdsByWorkspace = new Map<string, string[]>();
  for (const w of workspaceRows) {
    bizIdsByWorkspace.set(w.id, await loadBusinessIdsForTeamAccount(client, w.id));
  }

  const workspaceIds = workspaceRows.map((w) => w.id);

  const { data: focusRows } = await client
    .from('tasks')
    .select('id, title, status, priority, due_date, project_id, client_id')
    .eq('user_id', userId)
    .not('status', 'eq', 'done')
    .not('due_date', 'is', null)
    .or(`due_date.eq.${today},due_date.lt.${today}`)
    .order('due_date', { ascending: true })
    .limit(30);

  const { data: upcomingRows } = await client
    .from('tasks')
    .select('id, title, status, priority, due_date, project_id, client_id')
    .eq('user_id', userId)
    .not('status', 'eq', 'done')
    .gt('due_date', today)
    .order('due_date', { ascending: true })
    .limit(5);

  const [todaysFocus, upcoming] = await Promise.all([
    mapTasksToDashboard(client, (focusRows ?? []) as TaskRow[], workspaceById),
    mapTasksToDashboard(
      client,
      (upcomingRows ?? []) as TaskRow[],
      workspaceById,
    ),
  ]);

  let myDayEvents: PersonalCalendarEvent[] = [];
  if (workspaceIds.length > 0) {
    const { data: eventRows } = await client
      .from('job_events')
      .select('id, title, scheduled_start_at, account_id')
      .in('account_id', workspaceIds)
      .gte('scheduled_start_at', todayStart)
      .lte('scheduled_start_at', todayEnd)
      .order('scheduled_start_at', { ascending: true })
      .limit(20);

    myDayEvents = (eventRows ?? []).map((row) => {
      const r = row as {
        id: string;
        title?: string | null;
        scheduled_start_at?: string;
        account_id?: string;
      };
      const ws = r.account_id ? workspaceById.get(r.account_id) : null;
      return {
        id: r.id,
        title: r.title?.trim() || 'Event',
        timeLabel: formatTimeLabel(r.scheduled_start_at ?? ''),
        workspaceName: ws?.name?.trim() || ws?.slug || 'Workspace',
        workspaceColor: workspaceColorForSpaceType(ws?.space_type),
      };
    });
  }

  const workspaceOverview = await buildWorkspaceOverview(
    client,
    userId,
    workspaceRows,
    bizIdsByWorkspace,
  );

  return {
    userName,
    dateLabel: formatDateLabel(),
    workspaces,
    todaysFocus,
    upcoming,
    myDayEvents,
    workspaceOverview,
  };
});
