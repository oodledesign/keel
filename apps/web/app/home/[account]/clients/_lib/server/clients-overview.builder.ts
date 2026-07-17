import 'server-only';

import {
  DELIVERY_PROJECT_FILTER,
  PROJECTS_TABLE,
  PROJECT_ASSIGNMENTS_TABLE,
} from '~/lib/projects/delivery-project-db';
import { deliveryProjectTitle } from '~/lib/projects/project-types';

import {
  isMissingColumnError,
  isMissingRelationError,
  logMissingRelation,
} from '../../../_lib/server/supabase-errors';
import type {
  ClientOverviewItem,
  ClientOverviewProject,
  ClientOverviewTeamMember,
  ClientProjectHealth,
  ClientRow,
} from '../clients-overview.types';

type JobRow = {
  id: string;
  client_id: string | null;
  title: string;
  status: string;
  due_date: string | null;
};

type TaskRow = {
  id: string;
  client_id: string | null;
  project_id: string | null;
  status: string | null;
  due_date: string | null;
};

type AssignmentRow = {
  project_id: string;
  user_id: string;
};

type ContactRow = {
  client_id: string;
};

type MemberPreview = {
  user_id: string;
  name: string | null;
  picture_url?: string | null;
};

const COMPLETED_TASK_STATUSES = new Set(['done', 'completed', 'cancelled']);
const COMPLETED_JOB_STATUSES = new Set(['completed', 'cancelled']);

function isTaskOpen(status: string | null | undefined): boolean {
  if (!status) return true;
  return !COMPLETED_TASK_STATUSES.has(status);
}

function jobProgressPercent(job: JobRow, tasks: TaskRow[]): number {
  const jobTasks = tasks.filter((t) => t.project_id === job.id);
  if (jobTasks.length > 0) {
    const done = jobTasks.filter((t) => !isTaskOpen(t.status)).length;
    return Math.round((done / jobTasks.length) * 100);
  }

  switch (job.status) {
    case 'completed':
      return 100;
    case 'in_progress':
      return 55;
    case 'on_hold':
      return 30;
    case 'pending':
      return 10;
    default:
      return 0;
  }
}

function deriveProjectHealth(
  job: JobRow,
  progress: number,
): ClientProjectHealth {
  if (COMPLETED_JOB_STATUSES.has(job.status)) {
    return 'on_track';
  }

  const today = new Date().toISOString().slice(0, 10);
  if (job.due_date && job.due_date < today) {
    return 'behind';
  }

  if (job.status === 'on_hold') {
    return 'at_risk';
  }

  if (job.due_date) {
    const dueMs = new Date(`${job.due_date}T12:00:00`).getTime();
    const daysUntil = (dueMs - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysUntil <= 7 && progress < 75) {
      return 'at_risk';
    }
  }

  return 'on_track';
}

function buildTagline(client: ClientRow): string {
  if (client.company_name?.trim()) {
    return client.company_name.trim();
  }

  const location = [client.city].filter(Boolean).join(', ');
  if (location) {
    return location;
  }

  if (client.email?.trim()) {
    return client.email.trim();
  }

  return 'Client account';
}

function memberPreview(
  userId: string,
  membersById: Map<string, MemberPreview>,
): ClientOverviewTeamMember {
  const member = membersById.get(userId);
  return {
    userId,
    name: member?.name ?? null,
    pictureUrl: member?.picture_url ?? null,
  };
}

function mergeTasks(existing: TaskRow[], incoming: TaskRow[]): TaskRow[] {
  const seen = new Set(existing.map((task) => task.id));
  const merged = [...existing];
  for (const task of incoming) {
    if (!seen.has(task.id)) {
      merged.push(task);
      seen.add(task.id);
    }
  }
  return merged;
}

function mapLegacyTaskRows(rows: Array<Record<string, unknown>>): TaskRow[] {
  return rows.map((row) => ({
    id: String(row.id),
    client_id: (row.client_id as string | null) ?? null,
    project_id:
      (row.project_id as string | null) ??
      (row.job_id as string | null) ??
      null,
    status: (row.status as string | null) ?? null,
    due_date: (row.due_date as string | null) ?? null,
  }));
}

async function loadDeliveryProjectsForClients(
  db: any,
  accountId: string,
  clientIds: string[],
): Promise<JobRow[]> {
  const selectFields = 'id, client_id, title, name, status, due_date';

  let result = await db
    .from(PROJECTS_TABLE)
    .select(selectFields)
    .eq('account_id', accountId)
    .eq('project_type', DELIVERY_PROJECT_FILTER.project_type)
    .in('client_id', clientIds);

  if (result.error && isMissingColumnError(result.error)) {
    result = await db
      .from(PROJECTS_TABLE)
      .select(selectFields)
      .eq('account_id', accountId)
      .in('client_id', clientIds);
  }

  if (!result.error) {
    return (
      (result.data ?? []) as Array<{
        id: string;
        client_id: string | null;
        title: string | null;
        name: string | null;
        status: string | null;
        due_date: string | null;
      }>
    ).map((row) => ({
      id: row.id,
      client_id: row.client_id,
      title: deliveryProjectTitle(row),
      status: row.status ?? 'pending',
      due_date: row.due_date,
    }));
  }

  if (!isMissingRelationError(result.error)) {
    throw result.error;
  }

  logMissingRelation('clients-overview.projects', result.error);

  const legacy = await db
    .from('jobs')
    .select('id, client_id, title, status, due_date')
    .eq('account_id', accountId)
    .in('client_id', clientIds);

  if (legacy.error) {
    if (!isMissingRelationError(legacy.error)) {
      throw legacy.error;
    }
    logMissingRelation('clients-overview.jobs', legacy.error);
    return [];
  }

  return (legacy.data ?? []) as JobRow[];
}

async function loadTasksByProjectIds(
  db: any,
  projectIds: string[],
): Promise<TaskRow[]> {
  if (projectIds.length === 0) return [];

  let result = await db
    .from('tasks')
    .select('id, client_id, project_id, status, due_date')
    .in('project_id', projectIds);

  if (result.error && isMissingColumnError(result.error)) {
    result = await db
      .from('tasks')
      .select('id, client_id, job_id, status, due_date')
      .in('job_id', projectIds);
  }

  if (result.error) {
    if (
      !isMissingRelationError(result.error) &&
      !isMissingColumnError(result.error)
    ) {
      throw result.error;
    }
    logMissingRelation('clients-overview.tasks', result.error);
    return [];
  }

  return mapLegacyTaskRows(
    (result.data ?? []) as Array<Record<string, unknown>>,
  );
}

async function loadTasksByClientIds(
  db: any,
  clientIds: string[],
): Promise<TaskRow[]> {
  let result = await db
    .from('tasks')
    .select('id, client_id, project_id, status, due_date')
    .in('client_id', clientIds);

  if (result.error && isMissingColumnError(result.error)) {
    result = await db
      .from('tasks')
      .select('id, client_id, job_id, status, due_date')
      .in('client_id', clientIds);
  }

  if (result.error) {
    if (
      !isMissingRelationError(result.error) &&
      !isMissingColumnError(result.error)
    ) {
      throw result.error;
    }
    logMissingRelation('clients-overview.client-tasks', result.error);
    return [];
  }

  return mapLegacyTaskRows(
    (result.data ?? []) as Array<Record<string, unknown>>,
  );
}

async function loadProjectAssignments(
  db: any,
  accountId: string,
  projectIds: string[],
): Promise<AssignmentRow[]> {
  if (projectIds.length === 0) return [];

  const result = await db
    .from(PROJECT_ASSIGNMENTS_TABLE)
    .select('project_id, user_id')
    .eq('account_id', accountId)
    .in('project_id', projectIds);

  if (!result.error) {
    return (result.data ?? []) as AssignmentRow[];
  }

  if (!isMissingRelationError(result.error)) {
    throw result.error;
  }

  logMissingRelation('clients-overview.assignments', result.error);

  const legacy = await db
    .from('job_assignments')
    .select('job_id, user_id')
    .eq('account_id', accountId)
    .in('job_id', projectIds);

  if (legacy.error) {
    if (!isMissingRelationError(legacy.error)) {
      throw legacy.error;
    }
    logMissingRelation('clients-overview.legacy-assignments', legacy.error);
    return [];
  }

  return (
    (legacy.data ?? []) as Array<{ job_id: string; user_id: string }>
  ).map((row) => ({
    project_id: row.job_id,
    user_id: row.user_id,
  }));
}

export async function buildClientsOverview(params: {
  db: any;
  accountId: string;
  clients: ClientRow[];
  members: MemberPreview[];
}): Promise<ClientOverviewItem[]> {
  const { db, accountId, clients, members } = params;
  if (clients.length === 0) {
    return [];
  }

  const clientIds = clients.map((c) => c.id);
  const membersById = new Map(members.map((m) => [m.user_id, m]));

  const [jobs, clientTasks, contactsResult] = await Promise.all([
    loadDeliveryProjectsForClients(db, accountId, clientIds),
    loadTasksByClientIds(db, clientIds),
    db.from('client_contacts').select('client_id').in('client_id', clientIds),
  ]);

  const jobsForClient = jobs.filter(
    (j) => j.client_id && j.status !== 'cancelled',
  );
  const activeJobs = jobsForClient.filter(
    (j) => !COMPLETED_JOB_STATUSES.has(j.status),
  );

  const allProjectIds = jobsForClient.map((j) => j.id);
  const activeProjectIds = activeJobs.map((j) => j.id);

  let tasks: TaskRow[] = clientTasks;
  let assignments: AssignmentRow[] = [];
  let contacts: ContactRow[] = [];

  if (allProjectIds.length > 0) {
    const scopedProjectIds =
      activeProjectIds.length > 0 ? activeProjectIds : allProjectIds;
    const [projectTasks, assignmentRows] = await Promise.all([
      loadTasksByProjectIds(db, scopedProjectIds),
      loadProjectAssignments(db, accountId, allProjectIds),
    ]);
    tasks = mergeTasks(tasks, projectTasks);
    assignments = assignmentRows;
  }

  if (contactsResult.error) {
    if (!isMissingRelationError(contactsResult.error)) {
      throw contactsResult.error;
    }
    logMissingRelation('clients-overview.contacts', contactsResult.error);
  } else {
    contacts = contactsResult.data ?? [];
  }

  const jobsByClient = new Map<string, JobRow[]>();
  const allJobsByClient = new Map<string, JobRow[]>();
  for (const job of jobsForClient) {
    if (!job.client_id) continue;
    const allList = allJobsByClient.get(job.client_id) ?? [];
    allList.push(job);
    allJobsByClient.set(job.client_id, allList);
    if (!COMPLETED_JOB_STATUSES.has(job.status)) {
      const list = jobsByClient.get(job.client_id) ?? [];
      list.push(job);
      jobsByClient.set(job.client_id, list);
    }
  }

  const assignmentsByProject = new Map<string, string[]>();
  for (const row of assignments) {
    const list = assignmentsByProject.get(row.project_id) ?? [];
    if (!list.includes(row.user_id)) {
      list.push(row.user_id);
    }
    assignmentsByProject.set(row.project_id, list);
  }

  const contactsByClient = new Map<string, number>();
  for (const row of contacts) {
    contactsByClient.set(
      row.client_id,
      (contactsByClient.get(row.client_id) ?? 0) + 1,
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return clients.map((client) => {
    const clientJobs = jobsByClient.get(client.id) ?? [];
    const projectCount = (allJobsByClient.get(client.id) ?? []).length;

    const teamUserIds = new Set<string>();
    for (const job of clientJobs) {
      for (const userId of assignmentsByProject.get(job.id) ?? []) {
        teamUserIds.add(userId);
      }
    }

    const contactCount = contactsByClient.get(client.id) ?? 0;
    const teamMemberCount = Math.max(teamUserIds.size, contactCount);

    const dueTaskCount = tasks.filter(
      (t) =>
        t.client_id === client.id &&
        isTaskOpen(t.status) &&
        t.due_date &&
        t.due_date <= today,
    ).length;

    const projects: ClientOverviewProject[] = clientJobs
      .slice(0, 3)
      .map((job) => {
        const progress = jobProgressPercent(job, tasks);
        return {
          id: job.id,
          title: job.title,
          progress,
          health: deriveProjectHealth(job, progress),
        };
      });

    const teamMembers: ClientOverviewTeamMember[] = [...teamUserIds]
      .slice(0, 4)
      .map((userId) => memberPreview(userId, membersById));

    return {
      id: client.id,
      displayName: client.display_name?.trim() || 'Unnamed client',
      companyName: client.company_name,
      email: client.email,
      phone: client.phone,
      city: client.city,
      pictureUrl: client.picture_url ?? null,
      tagline: buildTagline(client),
      updatedAt: client.updated_at,
      projectCount,
      teamMemberCount,
      dueTaskCount,
      projects,
      teamMembers,
    };
  });
}
