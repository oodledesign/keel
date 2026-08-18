import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

import { todayLocalYmd } from '~/home/_lib/due-date-ymd';
import { queueBrainIndexSource } from '~/lib/brain/sync';
import { Database } from '~/lib/database.types';
import {
  notifyJobTaskAssigned,
  notifyPhaseCompleted,
} from '~/lib/jobs/project-notifications';
import { isBuiltinPhaseTemplateName } from '~/lib/projects/phase-template-builtins';
import { PROJECT_BOARD_TEMPLATE } from '~/lib/projects/project-board-phase-template';
import { WEBSITE_DESIGN_TEMPLATE } from '~/lib/websites/website-design-template';

import {
  isMissingColumnError,
  isMissingRelationError,
  logMissingRelation,
} from '../../../_lib/server/supabase-errors';
import {
  type AddPhaseNoteInput,
  type ApplyPhaseTemplateInput,
  type CreateJobTaskInput,
  type CreatePhaseInput,
  type DeleteJobTaskInput,
  type DeletePhaseInput,
  type EnsurePhasePageInput,
  type GetPhaseDetailInput,
  type JobBoardAssignee,
  type JobBoardResult,
  type JobBoardTask,
  type ListJobBoardInput,
  type ListPhaseTemplatesInput,
  type ListPhasesForJobInput,
  type MoveTaskInput,
  type PhaseListItem,
  type PhaseStatus,
  type PhaseTemplateListItem,
  type PhaseTemplatePhase,
  PhaseTemplatePhaseSchema,
  type ReorderPhasesInput,
  type SavePhasePageDocInput,
  type SaveProjectAsPhaseTemplateInput,
  type TaskStatusCount,
  type UpdateJobTaskInput,
  type UpdatePhaseInput,
  type UpdatePhaseNoteInput,
} from '../schema/project-phases.schema';

const STANDARD_DELIVERY_TEMPLATE = {
  name: 'Standard delivery',
  description: 'Discovery → Design → Build → Launch → Care',
  phases: [
    {
      name: 'Discovery',
      colour: '#3B82F6',
      description: 'Understand goals, constraints, and success criteria.',
      is_milestone: false,
    },
    {
      name: 'Design',
      colour: '#8B5CF6',
      description: 'UX, visual design, and technical approach.',
      is_milestone: false,
    },
    {
      name: 'Build',
      colour: '#FF5C34',
      description: 'Implementation and content production.',
      is_milestone: false,
    },
    {
      name: 'Launch',
      colour: '#F97316',
      description: 'Go-live, QA, and handover.',
      is_milestone: true,
    },
    {
      name: 'Care',
      colour: '#64748B',
      description: 'Ongoing support and optimisation.',
      is_milestone: false,
    },
  ] satisfies PhaseTemplatePhase[],
};

const TASK_STATUSES = [
  'todo',
  'in_progress',
  'client_review',
  'done',
  'cancelled',
] as const;

const JOB_BOARD_TASK_SELECT =
  'id, title, status, priority, due_date, sort_order, phase_id, project_id, user_id, assignee_contact_id, parent_task_id, notes, links, note_refs' as const;

function normalizeTaskLinks(
  value: unknown,
): Array<{ url: string; label?: string | null }> {
  if (!Array.isArray(value)) return [];
  const links: Array<{ url: string; label?: string | null }> = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as { url?: unknown; label?: unknown };
    const url = typeof row.url === 'string' ? row.url.trim() : '';
    if (!url) continue;
    const label =
      typeof row.label === 'string' ? row.label.trim() || null : null;
    links.push({ url, label });
  }
  return links;
}

function normalizeTaskNoteRefs(
  value: unknown,
): Array<{ id: string; title: string }> {
  if (!Array.isArray(value)) return [];
  const refs: Array<{ id: string; title: string }> = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as { id?: unknown; title?: unknown };
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    if (!id || !title) continue;
    refs.push({ id, title });
  }
  return refs;
}

function dueDateToYmd(value: Date | null | undefined): string | null {
  if (!value || Number.isNaN(value.getTime()) || value.getTime() === 0) {
    return null;
  }
  return value.toISOString().slice(0, 10);
}

function mapJobBoardTask(row: Record<string, unknown>): JobBoardTask {
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    status: String(row.status ?? 'todo'),
    priority: String(row.priority ?? 'medium'),
    due_date: (row.due_date as string | null) ?? null,
    sort_order: (row.sort_order as number | null) ?? null,
    phase_id: (row.phase_id as string | null) ?? null,
    job_id: (row.project_id as string | null) ?? null,
    user_id: (row.user_id as string | null) ?? null,
    assignee_contact_id: (row.assignee_contact_id as string | null) ?? null,
    parent_task_id: (row.parent_task_id as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    links: normalizeTaskLinks(row.links),
    note_refs: normalizeTaskNoteRefs(row.note_refs),
  };
}

const EMPTY_TASK_COUNTS = (): TaskStatusCount => ({
  todo: 0,
  in_progress: 0,
  client_review: 0,
  done: 0,
  cancelled: 0,
});

export function createProjectPhasesService(client: SupabaseClient<Database>) {
  return new ProjectPhasesService(client);
}

class ProjectPhasesService {
  constructor(private readonly client: SupabaseClient<Database>) {}

  private get db(): any {
    return this.client;
  }

  private get adminDb(): SupabaseClient<Database> {
    return getSupabaseServerAdminClient();
  }

  private isCheckConstraintError(err: unknown): boolean {
    const e = err as { code?: string; message?: string; details?: string };
    const blob = `${e?.message ?? ''} ${e?.details ?? ''}`.toLowerCase();

    return e?.code === '23514' || blob.includes('check constraint');
  }

  private throwErr(err: unknown, fallback = 'Something went wrong'): never {
    if (err instanceof Error) throw err;
    const msg =
      err &&
      typeof err === 'object' &&
      'message' in err &&
      typeof (err as { message: unknown }).message === 'string'
        ? (err as { message: string }).message
        : fallback;
    throw new Error(msg);
  }

  private async ensureUser() {
    const { data: user } = await requireUser(this.client);
    if (!user) throw new Error('Authentication required');
    return user;
  }

  private async ensureUserAndPermission(
    accountId: string,
    permission: 'jobs.view' | 'jobs.edit',
  ) {
    const user = await this.ensureUser();
    // Personal accounts have no memberships; owner id === account id.
    if (accountId === user.id) {
      return user;
    }
    const api = createTeamAccountsApi(this.client);
    const hasPermission = await api.hasPermission({
      userId: user.id,
      accountId,
      permission,
    });
    if (!hasPermission) throw new Error('Permission denied');
    return user;
  }

  private async verifyJob(accountId: string, jobId: string) {
    const { data, error } = await this.db
      .from('projects')
      .select(
        'id, account_id, title, name, client_id, status, priority, start_date, due_date, value_pence, cost_pence',
      )
      .eq('id', jobId)
      .eq('account_id', accountId)
      .eq('project_type', 'delivery')
      .maybeSingle();

    if (error) this.throwErr(error);
    if (!data) throw new Error('Job not found');
    return data as Record<string, unknown>;
  }

  private async verifyPhase(accountId: string, jobId: string, phaseId: string) {
    const { data, error } = await this.db
      .from('project_phases')
      .select('*')
      .eq('id', phaseId)
      .eq('account_id', accountId)
      .eq('project_id', jobId)
      .maybeSingle();

    if (error) this.throwErr(error);
    if (!data) throw new Error('Phase not found');
    return data as Record<string, unknown>;
  }

  private computeProgressPct(counts: TaskStatusCount): number {
    const total = TASK_STATUSES.reduce(
      (sum, status) => sum + counts[status],
      0,
    );
    if (total === 0) return 0;
    const active = total - counts.cancelled;
    if (active === 0) return 0;
    return Math.round((counts.done / active) * 100);
  }

  private buildPhaseListItems(
    phases: Array<Record<string, unknown>>,
    tasks: Array<{ phase_id: string | null; status: string }>,
    pageDocByPhase: Map<string, string>,
    noteCountByPhase: Map<string, number>,
  ): PhaseListItem[] {
    const countsByPhase = new Map<string, TaskStatusCount>();

    for (const task of tasks) {
      if (!task.phase_id) continue;
      const counts = countsByPhase.get(task.phase_id) ?? EMPTY_TASK_COUNTS();
      const status = task.status as keyof TaskStatusCount;
      if (status in counts) {
        counts[status] += 1;
      } else {
        counts.todo += 1;
      }
      countsByPhase.set(task.phase_id, counts);
    }

    return phases.map((phase) => {
      const id = phase.id as string;
      const taskCountsByStatus = countsByPhase.get(id) ?? EMPTY_TASK_COUNTS();
      return {
        id,
        account_id: phase.account_id as string,
        project_id: phase.project_id as string,
        name: phase.name as string,
        description: (phase.description as string | null) ?? null,
        status: phase.status as PhaseStatus,
        is_milestone: Boolean(phase.is_milestone),
        colour: (phase.colour as string | null) ?? null,
        sort_order: phase.sort_order as number,
        start_date: (phase.start_date as string | null) ?? null,
        due_date: (phase.due_date as string | null) ?? null,
        completed_at: (phase.completed_at as string | null) ?? null,
        created_at: phase.created_at as string,
        updated_at: phase.updated_at as string,
        taskCountsByStatus,
        progressPct: this.computeProgressPct(taskCountsByStatus),
        pageDocId: pageDocByPhase.get(id) ?? null,
        noteCount: noteCountByPhase.get(id) ?? 0,
      };
    });
  }

  async createPhase(input: CreatePhaseInput) {
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'jobs.edit',
    );
    await this.verifyJob(input.accountId, input.jobId);

    const { data: maxRow, error: maxErr } = await this.db
      .from('project_phases')
      .select('sort_order')
      .eq('account_id', input.accountId)
      .eq('project_id', input.jobId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxErr) this.throwErr(maxErr);

    const nextSort = ((maxRow?.sort_order as number | undefined) ?? -1) + 1;

    const { data, error } = await this.db
      .from('project_phases')
      .insert({
        account_id: input.accountId,
        project_id: input.jobId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        status: input.status ?? 'not_started',
        is_milestone: input.is_milestone ?? false,
        colour: input.colour ?? null,
        sort_order: nextSort,
        start_date: input.start_date
          ? input.start_date.toISOString().slice(0, 10)
          : null,
        due_date: input.due_date
          ? input.due_date.toISOString().slice(0, 10)
          : null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) this.throwErr(error);
    return data;
  }

  async updatePhase(input: UpdatePhaseInput) {
    await this.ensureUserAndPermission(input.accountId, 'jobs.edit');
    const existing = await this.verifyPhase(
      input.accountId,
      input.jobId,
      input.phaseId,
    );

    const payload: Record<string, unknown> = {};
    if (input.name !== undefined) payload.name = input.name.trim();
    if (input.description !== undefined) {
      payload.description = input.description?.trim() || null;
    }
    if (input.status !== undefined) {
      payload.status = input.status;
      if (input.status === 'complete') {
        payload.completed_at = new Date().toISOString();
      } else if (existing.status === 'complete') {
        payload.completed_at = null;
      }
    }
    if (input.is_milestone !== undefined)
      payload.is_milestone = input.is_milestone;
    if (input.colour !== undefined) payload.colour = input.colour;
    if (input.start_date !== undefined) {
      payload.start_date = input.start_date
        ? input.start_date.toISOString().slice(0, 10)
        : null;
    }
    if (input.due_date !== undefined) {
      payload.due_date = input.due_date
        ? input.due_date.toISOString().slice(0, 10)
        : null;
    }

    const { data, error } = await this.db
      .from('project_phases')
      .update(payload)
      .eq('id', input.phaseId)
      .eq('account_id', input.accountId)
      .eq('project_id', input.jobId)
      .select()
      .maybeSingle();

    if (error) this.throwErr(error);
    if (!data) {
      throw new Error(
        'Phase could not be updated. Check you have edit access and try again.',
      );
    }

    if (input.description !== undefined || input.status !== undefined) {
      queueBrainIndexSource(input.accountId, 'phase', input.phaseId);
    }

    if (
      input.status === 'complete' &&
      (existing.status as string) !== 'complete'
    ) {
      const job = await this.verifyJob(input.accountId, input.jobId);
      await notifyPhaseCompleted({
        accountId: input.accountId,
        accountSlug: input.accountSlug,
        jobId: input.jobId,
        jobTitle:
          ((job.title as string | null) ?? 'Project').trim() || 'Project',
        phaseName:
          (data.name as string) || (existing.name as string) || 'Phase',
      });
    }

    return data;
  }

  async deletePhase(input: DeletePhaseInput) {
    await this.ensureUserAndPermission(input.accountId, 'jobs.edit');
    await this.verifyPhase(input.accountId, input.jobId, input.phaseId);

    const { error } = await this.db
      .from('project_phases')
      .delete()
      .eq('id', input.phaseId)
      .eq('account_id', input.accountId)
      .eq('project_id', input.jobId);

    if (error) this.throwErr(error);
  }

  async reorderPhases(input: ReorderPhasesInput) {
    await this.ensureUserAndPermission(input.accountId, 'jobs.edit');
    await this.verifyJob(input.accountId, input.jobId);

    const { data: existing, error: listErr } = await this.db
      .from('project_phases')
      .select('id')
      .eq('account_id', input.accountId)
      .eq('project_id', input.jobId);

    if (listErr) this.throwErr(listErr);

    const existingIds = new Set(
      (existing ?? []).map((row: { id: string }) => row.id),
    );

    for (const id of input.orderedPhaseIds) {
      if (!existingIds.has(id)) {
        throw new Error(
          'Invalid phase order: phase does not belong to this job',
        );
      }
    }

    const results = await Promise.all(
      input.orderedPhaseIds.map((phaseId, index) =>
        this.db
          .from('project_phases')
          .update({ sort_order: index })
          .eq('id', phaseId)
          .eq('account_id', input.accountId)
          .eq('project_id', input.jobId),
      ),
    );

    for (const result of results) {
      if (result.error) this.throwErr(result.error);
    }
  }

  async listPhasesForJob(
    input: ListPhasesForJobInput,
  ): Promise<PhaseListItem[]> {
    await this.ensureUser();
    await this.verifyJob(input.accountId, input.jobId);

    const { data: phases, error: phaseErr } = await this.db
      .from('project_phases')
      .select('*')
      .eq('account_id', input.accountId)
      .eq('project_id', input.jobId)
      .order('sort_order', { ascending: true });

    if (phaseErr) this.throwErr(phaseErr);

    const phaseRows = (phases ?? []) as Array<Record<string, unknown>>;
    const phaseIds = phaseRows.map((p) => p.id as string);

    const [{ data: tasks }, { data: docs }, { data: notes }] =
      await Promise.all([
        this.db
          .from('tasks')
          .select('phase_id, status')
          .eq('project_id', input.jobId),
        phaseIds.length > 0
          ? this.db
              .from('docs')
              .select('id, phase_id')
              .eq('account_id', input.accountId)
              .eq('project_id', input.jobId)
              .eq('doc_type', 'phase_page')
              .in('phase_id', phaseIds)
          : Promise.resolve({ data: [] }),
        phaseIds.length > 0
          ? this.db
              .from('notes')
              .select('phase_id')
              .eq('account_id', input.accountId)
              .in('phase_id', phaseIds)
          : Promise.resolve({ data: [] }),
      ]);

    const pageDocByPhase = new Map<string, string>();
    for (const doc of docs ?? []) {
      if (doc.phase_id) pageDocByPhase.set(doc.phase_id, doc.id);
    }

    const noteCountByPhase = new Map<string, number>();
    for (const note of notes ?? []) {
      if (!note.phase_id) continue;
      noteCountByPhase.set(
        note.phase_id,
        (noteCountByPhase.get(note.phase_id) ?? 0) + 1,
      );
    }

    return this.buildPhaseListItems(
      phaseRows,
      (tasks ?? []) as Array<{ phase_id: string | null; status: string }>,
      pageDocByPhase,
      noteCountByPhase,
    );
  }

  async moveTask(input: MoveTaskInput) {
    await this.ensureUserAndPermission(input.accountId, 'jobs.edit');
    await this.verifyJob(input.accountId, input.jobId);

    if (input.phaseId) {
      await this.verifyPhase(input.accountId, input.jobId, input.phaseId);
    }

    const { data: task, error: taskErr } = await this.db
      .from('tasks')
      .select('id, project_id')
      .eq('id', input.taskId)
      .maybeSingle();

    if (taskErr) this.throwErr(taskErr);
    if (!task) throw new Error('Task not found');

    if (task.project_id && task.project_id !== input.jobId) {
      throw new Error('Task does not belong to this job');
    }

    const payload: Record<string, unknown> = {
      project_id: input.jobId,
      phase_id: input.phaseId,
    };
    if (input.sortOrder !== undefined) payload.sort_order = input.sortOrder;

    const { data, error } = await this.db
      .from('tasks')
      .update(payload)
      .eq('id', input.taskId)
      .select(JOB_BOARD_TASK_SELECT)
      .single();

    if (error) this.throwErr(error);

    const { error: cascadeErr } = await this.db
      .from('tasks')
      .update({ phase_id: input.phaseId })
      .eq('parent_task_id', input.taskId)
      .eq('project_id', input.jobId)
      .eq('account_id', input.accountId);

    if (cascadeErr) this.throwErr(cascadeErr);

    return mapJobBoardTask(data as Record<string, unknown>);
  }

  async listJobBoard(input: ListJobBoardInput): Promise<JobBoardResult> {
    await this.ensureUser();

    const job = await this.verifyJob(input.accountId, input.jobId);

    const clientPromise = job.client_id
      ? this.db
          .from('clients')
          .select('id, display_name, email, phone, company_name, picture_url')
          .eq('id', job.client_id as string)
          .eq('account_id', input.accountId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null });

    const [
      { data: clientRow, error: clientErr },
      { data: assignments },
      { data: membersRpc, error: membersErr },
      { data: phaseRows, error: phaseErr },
      { data: tasks, error: tasksErr },
    ] = await Promise.all([
      clientPromise,
      this.db
        .from('project_assignments')
        .select('user_id, role_on_project')
        .eq('account_id', input.accountId)
        .eq('project_id', input.jobId),
      this.client.rpc('get_account_members', {
        account_slug: input.accountSlug,
      }),
      this.db
        .from('project_phases')
        .select('*')
        .eq('account_id', input.accountId)
        .eq('project_id', input.jobId)
        .order('sort_order', { ascending: true }),
      this.db
        .from('tasks')
        .select(JOB_BOARD_TASK_SELECT)
        .eq('project_id', input.jobId)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true }),
    ]);

    if (clientErr) this.throwErr(clientErr);
    if (membersErr) this.throwErr(membersErr);
    if (phaseErr) this.throwErr(phaseErr);

    let taskRows = tasks;
    let resolvedTasksErr = tasksErr;

    if (
      tasksErr &&
      isMissingColumnError(tasksErr) &&
      /links|note_refs/.test(`${tasksErr.message ?? ''}`.toLowerCase())
    ) {
      const fallback = await this.db
        .from('tasks')
        .select(
          'id, title, status, priority, due_date, sort_order, phase_id, project_id, user_id, parent_task_id, notes',
        )
        .eq('project_id', input.jobId)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });
      taskRows = fallback.data;
      resolvedTasksErr = fallback.error;
    }

    if (resolvedTasksErr) this.throwErr(resolvedTasksErr);

    const client = (clientRow as Record<string, unknown> | null) ?? null;
    const phaseIds = ((phaseRows ?? []) as Array<Record<string, unknown>>).map(
      (p) => p.id as string,
    );

    const [{ data: docs }, { data: notes }] = await Promise.all([
      phaseIds.length > 0
        ? this.db
            .from('docs')
            .select('id, phase_id')
            .eq('account_id', input.accountId)
            .eq('project_id', input.jobId)
            .eq('doc_type', 'phase_page')
            .in('phase_id', phaseIds)
        : Promise.resolve({ data: [] }),
      phaseIds.length > 0
        ? this.db
            .from('notes')
            .select('phase_id')
            .eq('account_id', input.accountId)
            .in('phase_id', phaseIds)
        : Promise.resolve({ data: [] }),
    ]);

    const pageDocByPhase = new Map<string, string>();
    for (const doc of docs ?? []) {
      if (doc.phase_id) pageDocByPhase.set(doc.phase_id, doc.id);
    }

    const noteCountByPhase = new Map<string, number>();
    for (const note of notes ?? []) {
      if (!note.phase_id) continue;
      noteCountByPhase.set(
        note.phase_id,
        (noteCountByPhase.get(note.phase_id) ?? 0) + 1,
      );
    }

    const phases = this.buildPhaseListItems(
      (phaseRows ?? []) as Array<Record<string, unknown>>,
      (taskRows ?? []) as Array<{ phase_id: string | null; status: string }>,
      pageDocByPhase,
      noteCountByPhase,
    );

    const members = (membersRpc ?? []) as Array<{
      user_id: string;
      name: string | null;
      email: string | null;
      picture_url?: string | null;
    }>;
    const memberById = new Map(members.map((m) => [m.user_id, m]));

    const assignees: JobBoardAssignee[] = (assignments ?? []).map(
      (a: { user_id: string; role_on_project: string | null }) => {
        const member = memberById.get(a.user_id);
        return {
          user_id: a.user_id,
          role_on_job: a.role_on_project,
          name: member?.name ?? null,
          email: member?.email ?? null,
          picture_url: member?.picture_url ?? null,
        };
      },
    );

    const tasksByPhase: Record<string, JobBoardTask[]> = {};
    const jobTaskCounts = EMPTY_TASK_COUNTS();

    for (const row of taskRows ?? []) {
      const task = mapJobBoardTask(row as Record<string, unknown>);
      const key = task.phase_id ?? '__unphased__';
      if (!tasksByPhase[key]) tasksByPhase[key] = [];
      tasksByPhase[key].push(task);

      const status = task.status as keyof TaskStatusCount;
      if (status in jobTaskCounts) {
        jobTaskCounts[status] += 1;
      } else {
        jobTaskCounts.todo += 1;
      }
    }

    return {
      job,
      client,
      assignees,
      members,
      phases,
      tasksByPhase,
      valuePence: (job.value_pence as number | null) ?? null,
      costPence: (job.cost_pence as number | null) ?? null,
      progressPct: this.computeProgressPct(jobTaskCounts),
    };
  }

  async ensurePhasePage(input: EnsurePhasePageInput) {
    const user = await this.ensureUser();

    const { data: phase, error: phaseErr } = await this.db
      .from('project_phases')
      .select('id, account_id, project_id, name')
      .eq('id', input.phaseId)
      .eq('account_id', input.accountId)
      .maybeSingle();

    if (phaseErr) {
      if (isMissingRelationError(phaseErr)) {
        logMissingRelation('project_phases.ensurePhasePage', phaseErr);
        throw new Error(
          'Project phases are not set up on this database. Run migrations from apps/web (`pnpm exec supabase db push`).',
        );
      }

      this.throwErr(phaseErr);
    }

    if (!phase) throw new Error('Phase not found');

    return this.loadOrCreatePhasePageDoc(phase, user.id);
  }

  private async loadOrCreatePhasePageDoc(
    phase: Record<string, unknown>,
    userId: string,
    initialContent = '',
  ) {
    const phaseId = phase.id as string;
    const phaseName = (phase.name as string) ?? 'Phase';
    const accountId = phase.account_id as string;

    const { data: existing, error: findErr } = await this.db
      .from('docs')
      .select('*')
      .eq('account_id', accountId)
      .eq('phase_id', phaseId)
      .eq('doc_type', 'phase_page')
      .maybeSingle();

    if (!findErr && existing) {
      return existing;
    }

    if (findErr && !isMissingColumnError(findErr)) {
      this.throwErr(findErr);
    }

    if (findErr && isMissingColumnError(findErr)) {
      logMissingRelation('project_phases.phase_page.find', findErr);
    }

    const insertPayloads: Array<Record<string, unknown>> = [
      {
        account_id: accountId,
        project_id: phase.project_id,
        phase_id: phaseId,
        title: phaseName,
        content: initialContent,
        kind: 'written',
        doc_type: 'phase_page',
        category: 'idea',
        tags: [],
        user_id: userId,
        created_by: userId,
      },
      {
        account_id: accountId,
        project_id: phase.project_id,
        phase_id: phaseId,
        title: phaseName,
        content: initialContent,
        kind: 'written',
        doc_type: 'general',
        category: 'idea',
        tags: [],
        user_id: userId,
        created_by: userId,
      },
      {
        account_id: accountId,
        project_id: phase.project_id,
        phase_id: phaseId,
        title: phaseName,
        content: initialContent,
        kind: 'written',
        created_by: userId,
      },
      {
        account_id: accountId,
        project_id: phase.project_id,
        title: phaseName,
        content: initialContent,
        kind: 'written',
        created_by: userId,
      },
    ];

    for (const payload of insertPayloads) {
      const { data, error } = await this.adminDb
        .from('docs')
        .insert(payload)
        .select('*')
        .single();

      if (!error && data) {
        return data;
      }

      if (
        error &&
        !isMissingColumnError(error) &&
        !this.isCheckConstraintError(error)
      ) {
        this.throwErr(error);
      }
    }

    throw new Error(
      'Could not create the phase page document. Run migrations from apps/web (`pnpm exec supabase db push`).',
    );
  }

  async getPhaseDetail(input: GetPhaseDetailInput) {
    const user = await this.ensureUser();

    const { data: phase, error: phaseErr } = await this.db
      .from('project_phases')
      .select('*')
      .eq('id', input.phaseId)
      .eq('account_id', input.accountId)
      .maybeSingle();

    if (phaseErr) {
      if (isMissingRelationError(phaseErr)) {
        logMissingRelation('project_phases.getPhaseDetail', phaseErr);
        throw new Error(
          'Project phases are not set up on this database. Run migrations from apps/web (`pnpm exec supabase db push`).',
        );
      }

      this.throwErr(phaseErr);
    }

    if (!phase) throw new Error('Phase not found');

    const jobId = phase.project_id as string;

    const [pageDoc, tasksResult, notesResult] = await Promise.all([
      this.loadOrCreatePhasePageDoc(phase as Record<string, unknown>, user.id),
      this.db
        .from('tasks')
        .select(JOB_BOARD_TASK_SELECT)
        .eq('project_id', jobId)
        .eq('phase_id', input.phaseId)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true }),
      this.db
        .from('notes')
        .select('*')
        .eq('account_id', input.accountId)
        .eq('phase_id', input.phaseId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false }),
    ]);

    let tasks = tasksResult.data ?? [];

    if (tasksResult.error) {
      if (isMissingColumnError(tasksResult.error)) {
        logMissingRelation(
          'project_phases.getPhaseDetail.tasks',
          tasksResult.error,
        );
        tasks = [];
      } else {
        this.throwErr(tasksResult.error);
      }
    }

    let notes = notesResult.data ?? [];

    if (notesResult.error) {
      if (isMissingColumnError(notesResult.error)) {
        logMissingRelation(
          'project_phases.getPhaseDetail.notes',
          notesResult.error,
        );
        notes = [];
      } else {
        this.throwErr(notesResult.error);
      }
    }

    return {
      phase,
      pageDoc,
      tasks,
      notes,
    };
  }

  async createJobTask(input: CreateJobTaskInput) {
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'jobs.edit',
    );
    const job = await this.verifyJob(input.accountId, input.jobId);

    if (input.phaseId) {
      await this.verifyPhase(input.accountId, input.jobId, input.phaseId);
    }

    let sortOrder = input.sortOrder;
    if (sortOrder === undefined) {
      let q = this.db
        .from('tasks')
        .select('sort_order')
        .eq('project_id', input.jobId)
        .order('sort_order', { ascending: false })
        .limit(1);

      if (input.phaseId) {
        q = q.eq('phase_id', input.phaseId);
      } else {
        q = q.is('phase_id', null);
      }

      const { data: maxRow, error: maxErr } = await q.maybeSingle();
      if (maxErr) this.throwErr(maxErr);
      sortOrder = ((maxRow?.sort_order as number | undefined) ?? -1) + 1;
    }

    const assigneeUserId = input.assigneeUserId ?? user.id;
    const dueDateYmd = dueDateToYmd(input.dueDate) ?? todayLocalYmd();
    const parentTaskId = input.parentTaskId ?? null;

    if (parentTaskId) {
      const { data: parent, error: parentErr } = await this.db
        .from('tasks')
        .select('id, project_id')
        .eq('id', parentTaskId)
        .maybeSingle();
      if (parentErr) this.throwErr(parentErr);
      if (!parent || parent.project_id !== input.jobId) {
        throw new Error('Parent task not found');
      }
    }

    const { data, error } = await this.db
      .from('tasks')
      .insert({
        title: input.title.trim(),
        status: 'todo',
        priority: input.priority ?? 'medium',
        due_date: dueDateYmd,
        user_id: assigneeUserId,
        project_id: input.jobId,
        phase_id: input.phaseId,
        account_id: input.accountId,
        client_id: (job.client_id as string | null) ?? null,
        parent_task_id: parentTaskId,
        sort_order: sortOrder,
      })
      .select(JOB_BOARD_TASK_SELECT)
      .single();

    if (error) this.throwErr(error);

    const created = mapJobBoardTask(data as Record<string, unknown>);
    const subtaskTitles = parentTaskId
      ? []
      : (input.subtaskTitles ?? [])
          .map((title) => title.trim())
          .filter(Boolean);

    if (subtaskTitles.length > 0) {
      const subtaskRows = subtaskTitles.map((title, index) => ({
        title,
        status: 'todo' as const,
        priority: input.priority ?? 'medium',
        due_date: dueDateYmd,
        user_id: assigneeUserId,
        project_id: input.jobId,
        phase_id: input.phaseId,
        account_id: input.accountId,
        client_id: (job.client_id as string | null) ?? null,
        parent_task_id: created.id,
        sort_order: index,
      }));

      const { data: subtaskData, error: subtaskErr } = await this.db
        .from('tasks')
        .insert(subtaskRows)
        .select(JOB_BOARD_TASK_SELECT);

      if (subtaskErr) this.throwErr(subtaskErr);
      created.subtasks = (
        (subtaskData ?? []) as Array<Record<string, unknown>>
      ).map((row) => mapJobBoardTask(row));
    }

    if (!parentTaskId) {
      await notifyJobTaskAssigned({
        accountId: input.accountId,
        accountSlug: input.accountSlug,
        jobId: input.jobId,
        jobTitle:
          ((job.title as string | null) ?? 'Project').trim() || 'Project',
        taskTitle: (data.title as string) || input.title.trim(),
        assigneeUserId,
        actorUserId: user.id,
      });
    }

    return created;
  }

  async updateJobTask(input: UpdateJobTaskInput) {
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'jobs.edit',
    );
    const job = await this.verifyJob(input.accountId, input.jobId);

    const { data: task, error: taskErr } = await this.db
      .from('tasks')
      .select('id, project_id, user_id, title')
      .eq('id', input.taskId)
      .maybeSingle();

    if (taskErr) this.throwErr(taskErr);
    if (!task || task.project_id !== input.jobId) {
      throw new Error('Task not found');
    }

    const previousAssignee = task.user_id as string | null;

    const payload: Record<string, unknown> = {};
    if (input.title !== undefined) payload.title = input.title.trim();
    if (input.status !== undefined) {
      payload.status = input.status;
      payload.completed_at =
        input.status === 'done' ? new Date().toISOString() : null;
    }
    if (input.priority !== undefined) payload.priority = input.priority;
    if (input.assigneeUserId !== undefined) {
      payload.user_id = input.assigneeUserId;
    }
    if (input.assigneeContactId !== undefined) {
      if (input.assigneeContactId) {
        const { data: contact, error: contactErr } = await this.db
          .from('contacts')
          .select('id')
          .eq('id', input.assigneeContactId)
          .eq('account_id', input.accountId)
          .maybeSingle();
        if (contactErr) this.throwErr(contactErr);
        if (!contact) {
          throw new Error('Contact not found in this workspace');
        }
      }
      payload.assignee_contact_id = input.assigneeContactId;
    }
    if (input.dueDate !== undefined) {
      payload.due_date = dueDateToYmd(input.dueDate);
    }
    if (input.notes !== undefined) {
      payload.notes = input.notes?.trim() ? input.notes.trim() : null;
    }
    if (input.links !== undefined) {
      payload.links = input.links.map((link) => ({
        url: link.url.trim(),
        ...(link.label?.trim() ? { label: link.label.trim() } : {}),
      }));
    }
    if (input.noteRefs !== undefined) {
      const uniqueIds = [...new Set(input.noteRefs.map((ref) => ref.id))];
      if (uniqueIds.length > 0) {
        const { data: noteRows, error: notesErr } = await this.db
          .from('notes')
          .select('id, title, content')
          .eq('account_id', input.accountId)
          .in('id', uniqueIds);

        if (notesErr) this.throwErr(notesErr);

        const found = new Map(
          (noteRows ?? []).map((row) => [
            row.id as string,
            {
              id: row.id as string,
              title: ((row.title as string | null)?.trim() ||
                ((row.content as string | null) ?? '').trim().slice(0, 80) ||
                'Untitled note') as string,
            },
          ]),
        );

        if (found.size !== uniqueIds.length) {
          throw new Error('One or more notes could not be attached');
        }

        payload.note_refs = uniqueIds.map((id) => found.get(id)!);
      } else {
        payload.note_refs = [];
      }
    }

    if (Object.keys(payload).length === 0) {
      throw new Error('No updates provided');
    }

    // links/note_refs may lag generated Database types until typegen
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.db.from('tasks') as any)
      .update(payload)
      .eq('id', input.taskId)
      .eq('project_id', input.jobId)
      .select(JOB_BOARD_TASK_SELECT)
      .single();

    if (error) this.throwErr(error);

    const nextAssignee = data.user_id as string | null;
    if (
      input.assigneeUserId !== undefined &&
      nextAssignee &&
      nextAssignee !== previousAssignee
    ) {
      await notifyJobTaskAssigned({
        accountId: input.accountId,
        accountSlug: input.accountSlug,
        jobId: input.jobId,
        jobTitle:
          ((job.title as string | null) ?? 'Project').trim() || 'Project',
        taskTitle: (data.title as string) || 'Task',
        assigneeUserId: nextAssignee,
        actorUserId: user.id,
      });
    }

    return mapJobBoardTask(data as Record<string, unknown>);
  }

  async deleteJobTask(input: DeleteJobTaskInput) {
    await this.ensureUserAndPermission(input.accountId, 'jobs.edit');
    await this.verifyJob(input.accountId, input.jobId);

    const { data: task, error: taskErr } = await this.db
      .from('tasks')
      .select('id, project_id, phase_id')
      .eq('id', input.taskId)
      .eq('account_id', input.accountId)
      .maybeSingle();

    if (taskErr) this.throwErr(taskErr);
    if (!task || task.project_id !== input.jobId) {
      throw new Error('Task not found');
    }

    const { error } = await this.db
      .from('tasks')
      .delete()
      .eq('id', input.taskId)
      .eq('account_id', input.accountId)
      .eq('project_id', input.jobId);

    if (error) this.throwErr(error);

    return { phaseId: (task.phase_id as string | null) ?? null };
  }

  async savePhasePageDoc(input: SavePhasePageDocInput) {
    await this.ensureUserAndPermission(input.accountId, 'jobs.edit');
    await this.verifyPhase(input.accountId, input.jobId, input.phaseId);

    const { data: doc, error: docErr } = await this.db
      .from('docs')
      .select('id, phase_id')
      .eq('id', input.docId)
      .eq('account_id', input.accountId)
      .maybeSingle();

    if (docErr) this.throwErr(docErr);
    if (!doc || doc.phase_id !== input.phaseId) {
      throw new Error('Phase page not found');
    }

    // Content MUST be a Markdown string — see lib/markdown.ts contract.
    const payload: Record<string, unknown> = { content: input.content };
    if (input.title !== undefined) {
      payload.title = input.title.trim() || 'Untitled';
    }

    const { data, error } = await this.db
      .from('docs')
      .update(payload)
      .eq('id', input.docId)
      .eq('account_id', input.accountId)
      .select('id, title, content, updated_at')
      .single();

    if (error) this.throwErr(error);

    queueBrainIndexSource(input.accountId, 'phase', input.phaseId);

    return data;
  }

  async addPhaseNote(input: AddPhaseNoteInput) {
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'jobs.edit',
    );
    await this.verifyPhase(input.accountId, input.jobId, input.phaseId);

    const { data, error } = await this.db
      .from('notes')
      .insert({
        account_id: input.accountId,
        project_id: input.jobId,
        phase_id: input.phaseId,
        user_id: user.id,
        created_by: user.id,
        title: input.title?.trim() ?? '',
        content: input.content.trim(),
        category: 'idea',
        tags: [],
        is_pinned: false,
      })
      .select('*')
      .single();

    if (error) this.throwErr(error);
    return data;
  }

  async updatePhaseNote(input: UpdatePhaseNoteInput) {
    await this.ensureUserAndPermission(input.accountId, 'jobs.edit');
    await this.verifyPhase(input.accountId, input.jobId, input.phaseId);

    const payload: Record<string, unknown> = {};
    if (input.title !== undefined) payload.title = input.title.trim();
    if (input.content !== undefined) payload.content = input.content;
    if (input.isPinned !== undefined) payload.is_pinned = input.isPinned;

    if (Object.keys(payload).length === 0) {
      throw new Error('No updates provided');
    }

    const { data, error } = await this.db
      .from('notes')
      .update(payload)
      .eq('id', input.noteId)
      .eq('account_id', input.accountId)
      .eq('phase_id', input.phaseId)
      .select('*')
      .single();

    if (error) this.throwErr(error);
    return data;
  }

  private async ensureWebsiteDesignPhaseTemplate(
    accountId: string,
    userId: string,
  ) {
    const { data: existing, error: existingErr } = await this.db
      .from('project_phase_templates')
      .select('id, phases')
      .eq('account_id', accountId)
      .eq('name', WEBSITE_DESIGN_TEMPLATE.name)
      .maybeSingle();

    if (existingErr) this.throwErr(existingErr);

    if (existing?.id) {
      const parsed = z
        .array(PhaseTemplatePhaseSchema)
        .safeParse(existing.phases);
      const hasPageContent =
        parsed.success &&
        parsed.data.some((phase) => Boolean(phase.page_content?.trim()));
      // Resync when the phase list drifts from the current template
      // (e.g. Site Studio renamed phases to Brief → … → Build).
      const phaseNamesMatch =
        parsed.success &&
        parsed.data.length === WEBSITE_DESIGN_TEMPLATE.phases.length &&
        parsed.data.every(
          (phase, index) =>
            phase.name === WEBSITE_DESIGN_TEMPLATE.phases[index]?.name,
        );

      if (!hasPageContent || !phaseNamesMatch) {
        const { error: updateErr } = await this.db
          .from('project_phase_templates')
          .update({
            description: WEBSITE_DESIGN_TEMPLATE.description,
            phases: WEBSITE_DESIGN_TEMPLATE.phases,
          })
          .eq('id', existing.id);

        if (updateErr) this.throwErr(updateErr);
      }

      return;
    }

    const { error } = await this.db.from('project_phase_templates').insert({
      account_id: accountId,
      name: WEBSITE_DESIGN_TEMPLATE.name,
      description: WEBSITE_DESIGN_TEMPLATE.description,
      phases: WEBSITE_DESIGN_TEMPLATE.phases,
      created_by: userId,
    });

    if (error) this.throwErr(error);
  }

  private async ensureProjectBoardPhaseTemplate(
    accountId: string,
    userId: string,
  ) {
    const { data: existing, error: existingErr } = await this.db
      .from('project_phase_templates')
      .select('id, phases')
      .eq('account_id', accountId)
      .eq('name', PROJECT_BOARD_TEMPLATE.name)
      .maybeSingle();

    if (existingErr) this.throwErr(existingErr);

    if (existing?.id) {
      const parsed = z
        .array(PhaseTemplatePhaseSchema)
        .safeParse(existing.phases);
      const phaseNamesMatch =
        parsed.success &&
        parsed.data.length === PROJECT_BOARD_TEMPLATE.phases.length &&
        parsed.data.every(
          (phase, index) =>
            phase.name === PROJECT_BOARD_TEMPLATE.phases[index]?.name,
        );

      if (!phaseNamesMatch) {
        const { error: updateErr } = await this.db
          .from('project_phase_templates')
          .update({
            description: PROJECT_BOARD_TEMPLATE.description,
            phases: PROJECT_BOARD_TEMPLATE.phases,
          })
          .eq('id', existing.id);

        if (updateErr) this.throwErr(updateErr);
      }

      return;
    }

    const { error } = await this.db.from('project_phase_templates').insert({
      account_id: accountId,
      name: PROJECT_BOARD_TEMPLATE.name,
      description: PROJECT_BOARD_TEMPLATE.description,
      phases: PROJECT_BOARD_TEMPLATE.phases,
      created_by: userId,
    });

    if (error) this.throwErr(error);
  }

  private async ensureDefaultPhaseTemplate(accountId: string, userId: string) {
    const { data: existing, error: existingErr } = await this.db
      .from('project_phase_templates')
      .select('id')
      .eq('account_id', accountId)
      .limit(1);

    if (existingErr) this.throwErr(existingErr);
    if ((existing ?? []).length > 0) return;

    const { error } = await this.db.from('project_phase_templates').insert({
      account_id: accountId,
      name: STANDARD_DELIVERY_TEMPLATE.name,
      description: STANDARD_DELIVERY_TEMPLATE.description,
      phases: STANDARD_DELIVERY_TEMPLATE.phases,
      created_by: userId,
    });

    if (error) this.throwErr(error);
  }

  async listPhaseTemplates(
    input: ListPhaseTemplatesInput,
  ): Promise<PhaseTemplateListItem[]> {
    const user = await this.ensureUser();
    await this.ensureDefaultPhaseTemplate(input.accountId, user.id);
    await this.ensureWebsiteDesignPhaseTemplate(input.accountId, user.id);
    await this.ensureProjectBoardPhaseTemplate(input.accountId, user.id);

    const { data, error } = await this.db
      .from('project_phase_templates')
      .select('id, name, description, phases')
      .eq('account_id', input.accountId)
      .order('name', { ascending: true });

    if (error) this.throwErr(error);

    return (data ?? []).map((row: Record<string, unknown>) => {
      const parsed = z.array(PhaseTemplatePhaseSchema).safeParse(row.phases);
      const phases = parsed.success ? parsed.data : [];
      const taskCount = phases.reduce(
        (sum, phase) => sum + (phase.tasks?.length ?? 0),
        0,
      );
      const name = row.name as string;
      return {
        id: row.id as string,
        name,
        description: (row.description as string | null) ?? null,
        phaseCount: phases.length,
        taskCount,
        phaseNames: phases.map((phase) => phase.name),
        isBuiltin: isBuiltinPhaseTemplateName(name),
      };
    });
  }

  async applyPhaseTemplate(input: ApplyPhaseTemplateInput) {
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'jobs.edit',
    );
    const job = await this.verifyJob(input.accountId, input.jobId);

    const { data: template, error: templateErr } = await this.db
      .from('project_phase_templates')
      .select('id, name, phases')
      .eq('id', input.templateId)
      .eq('account_id', input.accountId)
      .maybeSingle();

    if (templateErr) this.throwErr(templateErr);
    if (!template) throw new Error('Template not found');

    const parsed = z.array(PhaseTemplatePhaseSchema).safeParse(template.phases);
    if (!parsed.success || parsed.data.length === 0) {
      throw new Error('Template has no valid phases');
    }

    const { data: maxRow } = await this.db
      .from('project_phases')
      .select('sort_order')
      .eq('account_id', input.accountId)
      .eq('project_id', input.jobId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    let sortOrder = ((maxRow?.sort_order as number | undefined) ?? -1) + 1;
    let taskCount = 0;

    for (const phaseInput of parsed.data) {
      const { data: inserted, error: phaseErr } = await this.db
        .from('project_phases')
        .insert({
          account_id: input.accountId,
          project_id: input.jobId,
          name: phaseInput.name.trim(),
          description: phaseInput.description?.trim() || null,
          status: 'not_started',
          is_milestone: phaseInput.is_milestone ?? false,
          colour: phaseInput.colour ?? null,
          sort_order: sortOrder++,
          created_by: user.id,
        })
        .select('id, name')
        .single();

      if (phaseErr) this.throwErr(phaseErr);

      const pageContent = phaseInput.page_content?.trim();
      if (pageContent && inserted?.id) {
        await this.loadOrCreatePhasePageDoc(
          {
            id: inserted.id,
            account_id: input.accountId,
            project_id: input.jobId,
            name: inserted.name,
          },
          user.id,
          pageContent,
        );
      }

      const taskTitles = (phaseInput.tasks ?? [])
        .map((task) => task.title.trim())
        .filter(Boolean)
        .slice(0, 50);

      if (inserted?.id && taskTitles.length > 0) {
        const rows = taskTitles.map((title, index) => ({
          title,
          status: 'todo' as const,
          priority: 'medium' as const,
          due_date: todayLocalYmd(),
          user_id: user.id,
          project_id: input.jobId,
          phase_id: inserted.id,
          account_id: input.accountId,
          client_id: (job.client_id as string | null) ?? null,
          sort_order: index,
        }));

        const { error: tasksErr } = await this.db.from('tasks').insert(rows);
        if (tasksErr) this.throwErr(tasksErr);
        taskCount += rows.length;
      }
    }

    return {
      ok: true as const,
      templateName: template.name as string,
      phaseCount: parsed.data.length,
      taskCount,
    };
  }

  async saveProjectAsPhaseTemplate(input: SaveProjectAsPhaseTemplateInput) {
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'jobs.edit',
    );
    const job = await this.verifyJob(input.accountId, input.jobId);
    const name = input.name.trim();

    if (isBuiltinPhaseTemplateName(name)) {
      throw new Error(
        'That name is reserved for a built-in template. Choose a different name.',
      );
    }

    const { data: existing, error: existingErr } = await this.db
      .from('project_phase_templates')
      .select('id')
      .eq('account_id', input.accountId)
      .ilike('name', name)
      .maybeSingle();

    if (existingErr) this.throwErr(existingErr);
    if (existing?.id) {
      throw new Error(
        'A workspace template with this name already exists. Choose a different name.',
      );
    }

    const { data: phaseRows, error: phaseErr } = await this.db
      .from('project_phases')
      .select('id, name, description, colour, is_milestone, sort_order')
      .eq('account_id', input.accountId)
      .eq('project_id', input.jobId)
      .order('sort_order', { ascending: true });

    if (phaseErr) this.throwErr(phaseErr);

    const phasesRaw = (phaseRows ?? []) as Array<{
      id: string;
      name: string;
      description: string | null;
      colour: string | null;
      is_milestone: boolean | null;
      sort_order: number | null;
    }>;

    if (phasesRaw.length === 0) {
      throw new Error('Add at least one phase before saving a template');
    }

    const phaseIds = phasesRaw.map((phase) => phase.id);
    const { data: taskRows, error: tasksErr } = await this.db
      .from('tasks')
      .select('title, phase_id, sort_order, status')
      .eq('project_id', input.jobId)
      .in('phase_id', phaseIds)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (tasksErr) this.throwErr(tasksErr);

    const tasksByPhase = new Map<string, string[]>();
    for (const row of taskRows ?? []) {
      const phaseId = row.phase_id as string | null;
      const title = ((row.title as string | null) ?? '').trim();
      const status = (row.status as string | null) ?? 'todo';
      if (!phaseId || !title || status === 'cancelled') continue;
      const list = tasksByPhase.get(phaseId) ?? [];
      if (list.length >= 50) continue;
      list.push(title);
      tasksByPhase.set(phaseId, list);
    }

    const phases: PhaseTemplatePhase[] = phasesRaw.map((phase) => ({
      name: phase.name,
      description: phase.description,
      colour: phase.colour,
      is_milestone: Boolean(phase.is_milestone),
      tasks: (tasksByPhase.get(phase.id) ?? []).map((title) => ({ title })),
    }));

    const parsed = z.array(PhaseTemplatePhaseSchema).safeParse(phases);
    if (!parsed.success) {
      throw new Error('Could not build a valid template from this project');
    }

    const taskCount = parsed.data.reduce(
      (sum, phase) => sum + (phase.tasks?.length ?? 0),
      0,
    );

    const fallbackDescription = `From “${
      ((job.title as string | null) ?? (job.name as string | null) ?? 'project')
        .toString()
        .trim() || 'project'
    }”`;

    const { data: inserted, error: insertErr } = await this.db
      .from('project_phase_templates')
      .insert({
        account_id: input.accountId,
        name,
        description: input.description?.trim() || fallbackDescription,
        phases: parsed.data,
        created_by: user.id,
      })
      .select('id, name')
      .single();

    if (insertErr) this.throwErr(insertErr);

    return {
      id: inserted.id as string,
      name: inserted.name as string,
      phaseCount: parsed.data.length,
      taskCount,
    };
  }
}
