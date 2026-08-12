import 'server-only';

import {
  resolveClientListTagline,
  resolveClientListTitle,
} from '~/lib/clients/resolve-client-list-display';
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
  ClientOverviewHighlight,
  ClientOverviewItem,
  ClientOverviewProject,
  ClientOverviewTeamMember,
  ClientProjectHealth,
  ClientRow,
  ClientsWorkspaceVariant,
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
  variant?: ClientsWorkspaceVariant;
}): Promise<ClientOverviewItem[]> {
  const { db, accountId, clients, members, variant = 'work' } = params;
  if (clients.length === 0) {
    return [];
  }

  if (variant === 'commercial') {
    return buildCommercialClientsOverview({ db, accountId, clients });
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
      displayName: resolveClientListTitle(client),
      companyName: client.company_name,
      email: client.email,
      phone: client.phone,
      city: client.city,
      pictureUrl: client.picture_url ?? null,
      tagline: resolveClientListTagline(client),
      updatedAt: client.updated_at,
      clientType:
        client.client_type === 'individual' || client.client_type === 'business'
          ? client.client_type
          : null,
      commercialRole: client.commercial_role ?? null,
      projectCount,
      teamMemberCount,
      dueTaskCount,
      projects,
      teamMembers,
      disposalCount: 0,
      requirementCount: 0,
      viewingCount: 0,
      leaseCount: 0,
      highlights: [],
    };
  });
}

async function buildCommercialClientsOverview(params: {
  db: any;
  accountId: string;
  clients: ClientRow[];
}): Promise<ClientOverviewItem[]> {
  const { db, accountId, clients } = params;
  const clientIds = clients.map((c) => c.id);

  const [
    instructingResult,
    partiesResult,
    requirementsResult,
    viewingsResult,
    leasesResult,
  ] = await Promise.all([
    db
      .from('commercial_listings')
      .select('id, name, status, instructing_client_id, updated_at')
      .eq('account_id', accountId)
      .in('instructing_client_id', clientIds),
    db
      .from('commercial_listing_parties')
      .select(
        'client_id, listing_id, commercial_listings(id, name, status, updated_at)',
      )
      .eq('account_id', accountId)
      .in('client_id', clientIds),
    db
      .from('commercial_requirements')
      .select('id, company_name, contact_name, stage, client_id, updated_at')
      .eq('account_id', accountId)
      .in('client_id', clientIds),
    db
      .from('commercial_viewings')
      .select('id, status, scheduled_at, client_id, listing_id')
      .eq('account_id', accountId)
      .in('client_id', clientIds),
    db
      .from('commercial_leases')
      .select('id, status, client_id, listing_id, updated_at')
      .eq('account_id', accountId)
      .in('client_id', clientIds),
  ]);

  for (const result of [
    instructingResult,
    partiesResult,
    requirementsResult,
    viewingsResult,
    leasesResult,
  ]) {
    if (result.error && !isMissingRelationError(result.error)) {
      throw result.error;
    }
    if (result.error) {
      logMissingRelation('clients-overview.commercial', result.error);
    }
  }

  type ListingRef = {
    id: string;
    name: string | null;
    status: string | null;
    updated_at?: string | null;
  };

  const disposalsByClient = new Map<
    string,
    Map<
      string,
      { id: string; title: string; status: string | null; updatedAt: string }
    >
  >();

  const addDisposal = (
    clientId: string,
    listing: ListingRef | null | undefined,
  ) => {
    if (!clientId || !listing?.id) return;
    const map = disposalsByClient.get(clientId) ?? new Map();
    map.set(listing.id, {
      id: listing.id,
      title: listing.name?.trim() || 'Untitled disposal',
      status: listing.status,
      updatedAt: listing.updated_at ?? '',
    });
    disposalsByClient.set(clientId, map);
  };

  for (const row of (instructingResult.data ?? []) as Array<{
    id: string;
    name: string | null;
    status: string | null;
    instructing_client_id: string | null;
    updated_at: string | null;
  }>) {
    if (!row.instructing_client_id) continue;
    addDisposal(row.instructing_client_id, row);
  }

  for (const row of (partiesResult.data ?? []) as Array<{
    client_id: string;
    commercial_listings: ListingRef | ListingRef[] | null;
  }>) {
    const listing = Array.isArray(row.commercial_listings)
      ? row.commercial_listings[0]
      : row.commercial_listings;
    addDisposal(row.client_id, listing);
  }

  const requirementsByClient = new Map<
    string,
    Array<{
      id: string;
      title: string;
      stage: string | null;
      updatedAt: string;
    }>
  >();
  for (const row of (requirementsResult.data ?? []) as Array<{
    id: string;
    company_name: string | null;
    contact_name: string | null;
    stage: string | null;
    client_id: string;
    updated_at: string | null;
  }>) {
    const list = requirementsByClient.get(row.client_id) ?? [];
    list.push({
      id: row.id,
      title:
        row.company_name?.trim() ||
        row.contact_name?.trim() ||
        'Untitled requirement',
      stage: row.stage,
      updatedAt: row.updated_at ?? '',
    });
    requirementsByClient.set(row.client_id, list);
  }

  const viewingsByClient = new Map<string, number>();
  for (const row of (viewingsResult.data ?? []) as Array<{
    client_id: string | null;
  }>) {
    if (!row.client_id) continue;
    viewingsByClient.set(
      row.client_id,
      (viewingsByClient.get(row.client_id) ?? 0) + 1,
    );
  }

  const leasesByClient = new Map<string, number>();
  for (const row of (leasesResult.data ?? []) as Array<{
    client_id: string | null;
  }>) {
    if (!row.client_id) continue;
    leasesByClient.set(
      row.client_id,
      (leasesByClient.get(row.client_id) ?? 0) + 1,
    );
  }

  return clients.map((client) => {
    const disposals = [...(disposalsByClient.get(client.id)?.values() ?? [])];
    const requirements = requirementsByClient.get(client.id) ?? [];
    const isPerson = client.client_type === 'individual';

    const highlights: ClientOverviewHighlight[] = [];
    if (isPerson) {
      for (const req of requirements
        .slice()
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 3)) {
        highlights.push({
          id: req.id,
          title: req.title,
          kind: 'requirement',
          meta: req.stage,
        });
      }
    } else {
      const mixed = [
        ...disposals.map((d) => ({
          id: d.id,
          title: d.title,
          kind: 'disposal' as const,
          meta: d.status,
          updatedAt: d.updatedAt,
        })),
        ...requirements.map((r) => ({
          id: r.id,
          title: r.title,
          kind: 'requirement' as const,
          meta: r.stage,
          updatedAt: r.updatedAt,
        })),
      ]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 3);
      for (const item of mixed) {
        highlights.push({
          id: item.id,
          title: item.title,
          kind: item.kind,
          meta: item.meta,
        });
      }
    }

    return {
      id: client.id,
      displayName: resolveClientListTitle(client),
      companyName: client.company_name,
      email: client.email,
      phone: client.phone,
      city: client.city,
      pictureUrl: client.picture_url ?? null,
      tagline: resolveClientListTagline(client),
      updatedAt: client.updated_at,
      clientType:
        client.client_type === 'individual' || client.client_type === 'business'
          ? client.client_type
          : null,
      commercialRole: client.commercial_role ?? null,
      projectCount: 0,
      teamMemberCount: 0,
      dueTaskCount: 0,
      projects: [],
      teamMembers: [],
      disposalCount: disposals.length,
      requirementCount: requirements.length,
      viewingCount: viewingsByClient.get(client.id) ?? 0,
      leaseCount: leasesByClient.get(client.id) ?? 0,
      highlights,
    };
  });
}
