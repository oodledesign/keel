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
import { displayTitle, resolveNoteAssignmentLabels } from '~/home/[account]/_lib/workspace-content/context-resolve';
import { workspaceColorForSpaceType } from '~/home/(user)/_lib/workspace-accent';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import type { PersonalNavWorkspace } from '~/config/personal-account-navigation.config';
import pathsConfig from '~/config/paths.config';
import { getPersonalAccountId } from '~/lib/recorder/personal-account';

import {
  createPeopleService,
} from '../../people/_lib/server/people.service';
import { loadPersonalDashboardShortcuts } from '~/lib/dashboard-shortcuts/load-shortcuts';
import { loadPersonalIncludeWorkspaceTasks } from '~/lib/personal-preferences/load-unified-tasks-preference';

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

export type PersonalPeopleUpcomingItem = {
  id: string;
  name: string;
  kind: 'catchup' | 'birthday' | 'anniversary';
  label: string;
  href: string;
};

export type PersonalRecentNote = {
  id: string;
  title: string;
  excerpt: string;
  updatedAt: string;
  workspaceName: string;
  workspaceSlug: string;
  workspaceColor: string;
  clientName: string | null;
  projectName: string | null;
  isPersonal?: boolean;
};

export type OzerDashboardData = {
  userName: string;
  dateLabel: string;
  workspaces: PersonalNavWorkspace[];
  dashboardShortcuts: import('~/lib/dashboard-shortcuts/types').ResolvedShortcut[];
  includeWorkspaceTasks: boolean;
  todaysFocus: PersonalDashboardTask[];
  upcoming: PersonalDashboardTask[];
  myDayEvents: PersonalCalendarEvent[];
  peopleUpcoming: PersonalPeopleUpcomingItem[];
  workspaceOverview: WorkspaceOverviewCard[];
  recentNotes: PersonalRecentNote[];
  brainWorkspaceSlug: string | null;
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

function parseYmdLocal(ymd: string): Date {
  const p = parseDueDateParts(ymd);
  if (!p) return new Date(NaN);
  return new Date(p.y, p.m - 1, p.d, 12, 0, 0, 0);
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
  account_id?: string | null;
  job_id?: string | null;
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

type JobRow = {
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
  const jobIds = [
    ...new Set(rows.map((r) => r.job_id).filter(Boolean)),
  ] as string[];

  const [projectsResult, clientsResult, jobsResult] = await Promise.all([
    projectIds.length > 0
      ? client
          .from('projects')
          .select('id, name, account_id, businesses(colour)')
          .in('id', projectIds)
      : Promise.resolve({ data: [] as ProjectRow[] }),
    clientIds.length > 0
      ? client.from('clients').select('id, account_id').in('id', clientIds)
      : Promise.resolve({ data: [] as ClientRow[] }),
    jobIds.length > 0
      ? client.from('jobs').select('id, account_id').in('id', jobIds)
      : Promise.resolve({ data: [] as JobRow[] }),
  ]);

  const projects = new Map<string, ProjectRow>();
  for (const p of (projectsResult.data ?? []) as ProjectRow[]) {
    projects.set(p.id, p);
  }
  const clients = new Map<string, ClientRow>();
  for (const c of (clientsResult.data ?? []) as ClientRow[]) {
    clients.set(c.id, c);
  }
  const jobs = new Map<string, JobRow>();
  for (const j of (jobsResult.data ?? []) as JobRow[]) {
    jobs.set(j.id, j);
  }

  const today = todayLocalYmd();

  return rows.map((row) => {
    let accountId: string | null = row.account_id ?? null;
    let accent: string | null = null;

    if (row.project_id) {
      const p = projects.get(row.project_id);
      accountId = accountId ?? p?.account_id ?? null;
      accent = p?.businesses?.colour ?? null;
    } else if (row.client_id) {
      accountId = accountId ?? clients.get(row.client_id)?.account_id ?? null;
    }

    if (!accountId && row.job_id) {
      accountId = jobs.get(row.job_id)?.account_id ?? null;
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
  const [{ data: projectsData }, { data: clientsData }, { data: jobsData }] =
    await Promise.all([
      client.from('projects').select('id').eq('account_id', accountId),
      client.from('clients').select('id').eq('account_id', accountId),
      client.from('jobs').select('id').eq('account_id', accountId),
    ]);
  const projectIds = (projectsData ?? []).map((p: { id: string }) => p.id);
  const clientIds = (clientsData ?? []).map((c: { id: string }) => c.id);
  const jobIds = (jobsData ?? []).map((j: { id: string }) => j.id);
  if (projectIds.length === 0 && clientIds.length === 0 && jobIds.length === 0) {
    return 0;
  }

  let q = client
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('status', 'eq', 'done');

  const filters: string[] = [`account_id.eq.${accountId}`];
  if (projectIds.length > 0) {
    filters.push(`project_id.in.(${projectIds.join(',')})`);
  }
  if (clientIds.length > 0) {
    filters.push(`client_id.in.(${clientIds.join(',')})`);
  }
  if (jobIds.length > 0) {
    filters.push(`job_id.in.(${jobIds.join(',')})`);
  }

  q = q.or(filters.join(','));

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

async function loadRecentNotesAcrossWorkspaces(
  client: ReturnType<typeof getSupabaseServerClient>,
  workspaceRows: WorkspaceAccountRow[],
  personalAccountId: string | null,
): Promise<PersonalRecentNote[]> {
  const withSlug = workspaceRows.filter((w) => w.slug);
  const accountIds = [
    ...withSlug.map((w) => w.id),
    ...(personalAccountId ? [personalAccountId] : []),
  ];

  if (accountIds.length === 0) return [];

  const workspaceById = new Map(withSlug.map((w) => [w.id, w]));
  if (personalAccountId) {
    workspaceById.set(personalAccountId, {
      id: personalAccountId,
      name: 'Personal',
      slug: null,
      space_type: null,
      is_personal_account: true,
    });
  }

  const { data, error } = await client
    .from('notes')
    .select(
      'id, title, content, updated_at, account_id, client_id, client_org_id, project_id, clients(display_name), client_orgs(name), projects(name, title)',
    )
    .in('account_id', accountIds)
    .order('updated_at', { ascending: false })
    .limit(12);

  if (error) {
    const m = (error.message ?? '').toLowerCase();
    if (
      m.includes('schema cache') ||
      m.includes('does not exist') ||
      error.code === 'PGRST205' ||
      error.code === '42P01'
    ) {
      return [];
    }
    throw error;
  }

  type NoteRow = {
    id: string;
    title: string | null;
    content: string | null;
    updated_at: string;
    account_id: string;
    client_id?: string | null;
    client_org_id?: string | null;
    project_id?: string | null;
    clients?: { display_name?: string | null } | null;
    client_orgs?: { name?: string | null } | null;
    projects?: { name?: string | null; title?: string | null } | null;
  };

  return ((data ?? []) as NoteRow[]).map((row) => {
    const workspace = workspaceById.get(row.account_id);
    const content = (row.content as string | null) ?? '';
    const titleRaw = (row.title as string | null) ?? '';
    const title = displayTitle(titleRaw, content);
    const plain = content
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const spaceType = normalizeSpaceType(workspace?.space_type ?? null);
    const isPersonal = workspace?.is_personal_account === true;
    const assignment = resolveNoteAssignmentLabels(
      row as Parameters<typeof resolveNoteAssignmentLabels>[0],
    );

    return {
      id: row.id,
      title,
      excerpt: plain.slice(0, 120) || 'No content yet',
      updatedAt: row.updated_at,
      workspaceName: isPersonal
        ? 'Personal'
        : workspace?.name?.trim() || workspace?.slug || 'Workspace',
      workspaceSlug: isPersonal ? '' : (workspace?.slug ?? ''),
      workspaceColor: isPersonal
        ? '#FFE3DA'
        : workspaceColorForSpaceType(spaceType),
      clientName: assignment.clientName,
      projectName: assignment.projectName,
      isPersonal,
    };
  });
}

function resolveBrainWorkspaceSlug(
  workspaceRows: WorkspaceAccountRow[],
): string | null {
  const work = workspaceRows.find(
    (w) => w.slug && normalizeSpaceType(w.space_type) === 'work',
  );
  return work?.slug ?? workspaceRows.find((w) => w.slug)?.slug ?? null;
}

// ─── Main loader ─────────────────────────────────────────────────────

export const loadOzerDashboard = cache(async (): Promise<OzerDashboardData> => {
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
  const bizIdEntries = await Promise.all(
    workspaceRows.map(async (w) => {
      const ids = await loadBusinessIdsForTeamAccount(client, w.id);
      return [w.id, ids] as const;
    }),
  );
  for (const [workspaceId, ids] of bizIdEntries) {
    bizIdsByWorkspace.set(workspaceId, ids);
  }

  const workspaceIds = workspaceRows.map((w) => w.id);

  const { data: focusRows } = await client
    .from('tasks')
    .select('id, title, status, priority, due_date, project_id, client_id, account_id, job_id')
    .eq('user_id', userId)
    .not('status', 'eq', 'done')
    .not('due_date', 'is', null)
    .or(`due_date.eq.${today},due_date.lt.${today}`)
    .order('due_date', { ascending: true })
    .limit(30);

  const { data: upcomingRows } = await client
    .from('tasks')
    .select('id, title, status, priority, due_date, project_id, client_id, account_id, job_id')
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

  let peopleUpcoming: PersonalPeopleUpcomingItem[] = [];
  try {
    const peopleService = createPeopleService(client);
    const people = await peopleService.listPeople(userId);
    const items: PersonalPeopleUpcomingItem[] = [];

    for (const p of people) {
      const name = p.nickname?.trim() || p.full_name;
      const href = `${pathsConfig.app.personalPeople}/${p.id}`;

      if (p.catchupOverdue) {
        items.push({
          id: `${p.id}-catchup`,
          name,
          kind: 'catchup',
          label: 'Catch up due',
          href,
        });
      }

      if (p.daysUntilBirthday !== null && p.daysUntilBirthday <= 7) {
        items.push({
          id: `${p.id}-birthday`,
          name,
          kind: 'birthday',
          label:
            p.daysUntilBirthday === 0
              ? 'Birthday today'
              : `Birthday in ${p.daysUntilBirthday} days`,
          href,
        });
      }

      const anniversary = p.dates.find((d) => d.kind === 'anniversary');
      if (anniversary) {
        const today = todayLocalYmd();
        const year = new Date().getFullYear();
        const ref = `${year}-${String(anniversary.month).padStart(2, '0')}-${String(anniversary.day).padStart(2, '0')}`;
        const diff = Math.round(
          (parseYmdLocal(ref).getTime() - parseYmdLocal(today).getTime()) /
            (1000 * 60 * 60 * 24),
        );
        if (diff >= 0 && diff <= 7) {
          items.push({
            id: `${p.id}-anniversary`,
            name,
            kind: 'anniversary',
            label:
              diff === 0
                ? 'Anniversary today'
                : `Anniversary in ${diff} days`,
            href,
          });
        }
      }
    }

    peopleUpcoming = items.slice(0, 8);
  } catch {
    peopleUpcoming = [];
  }

  let dashboardShortcuts: Awaited<ReturnType<typeof loadPersonalDashboardShortcuts>> =
    [];
  let includeWorkspaceTasks = true;
  try {
    [dashboardShortcuts, includeWorkspaceTasks] = await Promise.all([
      loadPersonalDashboardShortcuts(client, userId),
      loadPersonalIncludeWorkspaceTasks(client, userId),
    ]);
  } catch {
    dashboardShortcuts = [];
    includeWorkspaceTasks = true;
  }

  const filterPersonalOnly = (tasks: PersonalDashboardTask[]) =>
    includeWorkspaceTasks
      ? tasks
      : tasks.filter((t) => t.workspaceSlug === null);

  let recentNotes: PersonalRecentNote[] = [];
  try {
    const personalAccountId = await getPersonalAccountId(client, userId);
    recentNotes = await loadRecentNotesAcrossWorkspaces(
      client,
      workspaceRows,
      personalAccountId,
    );
  } catch {
    recentNotes = [];
  }

  const brainWorkspaceSlug = resolveBrainWorkspaceSlug(workspaceRows);

  return {
    userName,
    dateLabel: formatDateLabel(),
    workspaces,
    dashboardShortcuts,
    includeWorkspaceTasks,
    todaysFocus: filterPersonalOnly(todaysFocus),
    upcoming: filterPersonalOnly(upcoming),
    myDayEvents,
    peopleUpcoming,
    workspaceOverview,
    recentNotes,
    brainWorkspaceSlug,
  };
});
