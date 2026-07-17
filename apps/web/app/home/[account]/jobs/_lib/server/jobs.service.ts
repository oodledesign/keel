import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

import {
  queueBrainDeleteSource,
  queueBrainIndexSource,
} from '~/lib/brain/sync';
import { Database } from '~/lib/database.types';
import {
  DELIVERY_PROJECT_FILTER,
  PROJECTS_TABLE,
  PROJECT_ASSIGNMENTS_TABLE,
  PROJECT_DELIVERY_NOTES_TABLE,
  PROJECT_PRIMARY_CLIENT_EMBED,
} from '~/lib/projects/delivery-project-db';
import { deliveryProjectTitle } from '~/lib/projects/project-types';

import type {
  AddJobAssignmentInput,
  AddJobNoteInput,
  CreateJobInput,
  DeleteJobInput,
  DeleteJobNoteInput,
  GetJobInput,
  ListJobAssignmentsInput,
  ListJobNotesInput,
  ListJobsInput,
  RemoveJobAssignmentInput,
  UpdateJobInput,
} from '../schema/jobs.schema';

type AccountRole = 'owner' | 'admin' | 'staff' | 'contractor' | 'client' | null;

export function createJobsService(client: SupabaseClient<Database>) {
  return new JobsService(client);
}

// Database types may not include jobs/job_assignments/job_notes until supabase:typegen is run.

class JobsService {
  constructor(private readonly client: SupabaseClient<Database>) {}

  private get db(): any {
    return this.client;
  }

  /** Throw a normal Error so the client never receives raw Supabase/PostgREST objects. */
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
    const api = createTeamAccountsApi(this.client);
    const hasPermission = await api.hasPermission({
      userId: user.id,
      accountId,
      permission,
    });
    if (!hasPermission) throw new Error('Permission denied');
    return user;
  }

  /** Returns current user's role on the account (owner, admin, staff, contractor, client) or null. */
  private async getMembershipRole(accountId: string): Promise<AccountRole> {
    const user = await this.ensureUser();
    const { data, error } = await this.db
      .from('accounts_memberships')
      .select('account_role')
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) this.throwErr(error);
    return (data?.account_role as AccountRole) ?? null;
  }

  /** Require Owner or Admin (for delete job / delete note). */
  private async ensureOwnerOrAdmin(accountId: string) {
    const role = await this.getMembershipRole(accountId);
    if (role !== 'owner' && role !== 'admin') {
      throw new Error('Only account owners and admins can perform this action');
    }
  }

  /** Check if current user is assigned to the project (for contractor update/note). */
  private async isAssignedToJob(
    accountId: string,
    jobId: string,
  ): Promise<boolean> {
    const user = await this.ensureUser();
    const { data, error } = await this.db
      .from(PROJECT_ASSIGNMENTS_TABLE)
      .select('project_id')
      .eq('project_id', jobId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) this.throwErr(error);
    return !!data;
  }

  private mapDeliveryRow(row: Record<string, unknown>) {
    return {
      ...row,
      title: deliveryProjectTitle(
        row as { title?: string | null; name?: string | null },
      ),
    };
  }

  async listJobs(params: ListJobsInput) {
    await this.ensureUser();

    const {
      accountId,
      tab,
      page = 1,
      pageSize = 20,
      query,
      status,
      priority,
    } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let q = this.db
      .from(PROJECTS_TABLE)
      .select(`*, ${PROJECT_PRIMARY_CLIENT_EMBED}`, { count: 'exact' })
      .eq('account_id', accountId)
      .eq('project_type', DELIVERY_PROJECT_FILTER.project_type)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (tab === 'active') {
      q = q.not('status', 'in', '("completed","cancelled")');
    } else if (tab === 'completed') {
      q = q.in('status', ['completed', 'cancelled']);
    }

    if (query?.trim()) {
      const term = `%${query.trim()}%`;
      q = q.or(
        `name.ilike.${term},title.ilike.${term},description.ilike.${term}`,
      );
    }
    if (status) q = q.eq('status', status);
    if (priority) q = q.eq('priority', priority);

    let rows: unknown[] | null = null;
    let count: number | null = null;
    let error: { message?: string } | null = null;

    const result = await q;
    error = result.error;
    rows = result.data;
    count = result.count ?? null;

    if (error) {
      let fallbackQ = this.db
        .from(PROJECTS_TABLE)
        .select('*', { count: 'exact' })
        .eq('account_id', accountId)
        .eq('project_type', DELIVERY_PROJECT_FILTER.project_type)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
        .range(from, to);
      if (tab === 'active') {
        fallbackQ = fallbackQ.not('status', 'in', '("completed","cancelled")');
      } else if (tab === 'completed') {
        fallbackQ = fallbackQ.in('status', ['completed', 'cancelled']);
      }
      if (query?.trim()) {
        const term = `%${query.trim()}%`;
        fallbackQ = fallbackQ.or(
          `title.ilike.${term},description.ilike.${term}`,
        );
      }
      if (status) fallbackQ = fallbackQ.eq('status', status);
      if (priority) fallbackQ = fallbackQ.eq('priority', priority);
      const fallbackResult = await fallbackQ;
      if (fallbackResult.error)
        this.throwErr(fallbackResult.error, 'Failed to load jobs');
      rows = fallbackResult.data;
      count = fallbackResult.count ?? null;
    }
    const jobs = (rows ?? []).map((row) =>
      this.mapDeliveryRow(row as Record<string, unknown>),
    );
    const jobIds = jobs.map((j) => j.id as string);
    if (jobIds.length === 0) {
      return { data: jobs as Record<string, unknown>[], total: count ?? 0 };
    }
    const { data: assignments } = await this.db
      .from(PROJECT_ASSIGNMENTS_TABLE)
      .select('project_id, user_id, role_on_project')
      .in('project_id', jobIds);
    const countByJob = (assignments ?? []).reduce<Record<string, number>>(
      (acc, a: { project_id: string }) => {
        acc[a.project_id] = (acc[a.project_id] ?? 0) + 1;
        return acc;
      },
      {},
    );
    const assigneesByJob = (assignments ?? []).reduce<
      Record<string, { user_id: string; role_on_job: string | null }[]>
    >(
      (
        acc,
        row: {
          project_id: string;
          user_id: string;
          role_on_project: string | null;
        },
      ) => {
        if (!acc[row.project_id]) acc[row.project_id] = [];
        acc[row.project_id].push({
          user_id: row.user_id,
          role_on_job: row.role_on_project,
        });
        return acc;
      },
      {},
    );
    const data = jobs.map((job) => ({
      ...job,
      assignment_count: countByJob[job.id] ?? 0,
      assignees: assigneesByJob[job.id] ?? [],
    }));
    return { data, total: count ?? 0 };
  }

  async getJob(params: GetJobInput) {
    await this.ensureUser();

    const { data, error } = await this.db
      .from(PROJECTS_TABLE)
      .select(`*, ${PROJECT_PRIMARY_CLIENT_EMBED}`)
      .eq('id', params.jobId)
      .eq('account_id', params.accountId)
      .eq('project_type', DELIVERY_PROJECT_FILTER.project_type)
      .single();

    if (error) this.throwErr(error);
    return this.mapDeliveryRow(data as Record<string, unknown>);
  }

  async createJob(input: CreateJobInput) {
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'jobs.edit',
    );

    const { data, error } = await this.db
      .from(PROJECTS_TABLE)
      .insert({
        account_id: input.accountId,
        client_id: input.client_id ?? null,
        project_type: DELIVERY_PROJECT_FILTER.project_type,
        name: input.title,
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? 'pending',
        priority: input.priority ?? 'medium',
        start_date: input.start_date ?? null,
        due_date: input.due_date ?? null,
        estimated_minutes: input.estimated_minutes ?? null,
        actual_minutes: input.actual_minutes ?? null,
        value_pence: input.value_pence ?? null,
        cost_pence: input.cost_pence ?? null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) this.throwErr(error);
    queueBrainIndexSource(input.accountId, 'job', data.id as string);
    return this.mapDeliveryRow(data as Record<string, unknown>);
  }

  async updateJob(input: UpdateJobInput) {
    const user = await this.ensureUser();
    const api = createTeamAccountsApi(this.client);
    const hasEdit = await api.hasPermission({
      userId: user.id,
      accountId: input.accountId,
      permission: 'jobs.edit',
    });

    const existing = await this.getJob({
      accountId: input.accountId,
      jobId: input.jobId,
    });
    if (!existing) throw new Error('Job not found');

    if (hasEdit) {
      const payload: Record<string, unknown> = {};
      if (input.client_id !== undefined) payload.client_id = input.client_id;
      if (input.title !== undefined) {
        payload.title = input.title;
        payload.name = input.title;
      }
      if (input.description !== undefined)
        payload.description = input.description;
      if (input.status !== undefined) payload.status = input.status;
      if (input.priority !== undefined) payload.priority = input.priority;
      if (input.start_date !== undefined) payload.start_date = input.start_date;
      if (input.due_date !== undefined) payload.due_date = input.due_date;
      if (input.estimated_minutes !== undefined)
        payload.estimated_minutes = input.estimated_minutes;
      if (input.actual_minutes !== undefined)
        payload.actual_minutes = input.actual_minutes;
      if (input.value_pence !== undefined)
        payload.value_pence = input.value_pence;
      if (input.cost_pence !== undefined) payload.cost_pence = input.cost_pence;

      const { data, error } = await this.db
        .from(PROJECTS_TABLE)
        .update(payload)
        .eq('id', input.jobId)
        .eq('account_id', input.accountId)
        .eq('project_type', DELIVERY_PROJECT_FILTER.project_type)
        .select()
        .single();
      if (error) this.throwErr(error);
      queueBrainIndexSource(input.accountId, 'job', input.jobId);
      return this.mapDeliveryRow(data as Record<string, unknown>);
    }

    const assigned = await this.isAssignedToJob(input.accountId, input.jobId);
    if (!assigned) throw new Error('Permission denied');

    const payload: Record<string, unknown> = {};
    if (input.status !== undefined) payload.status = input.status;
    if (input.actual_minutes !== undefined)
      payload.actual_minutes = input.actual_minutes;

    const { data, error } = await this.db
      .from(PROJECTS_TABLE)
      .update(payload)
      .eq('id', input.jobId)
      .eq('account_id', input.accountId)
      .eq('project_type', DELIVERY_PROJECT_FILTER.project_type)
      .select()
      .single();
    if (error) this.throwErr(error);
    return this.mapDeliveryRow(data as Record<string, unknown>);
  }

  async deleteJob(params: DeleteJobInput) {
    await this.ensureUser();
    const existing = await this.getJob({
      accountId: params.accountId,
      jobId: params.jobId,
    });
    if (!existing) throw new Error('Job not found');
    await this.ensureOwnerOrAdmin(params.accountId);

    const { error } = await this.db
      .from(PROJECTS_TABLE)
      .delete()
      .eq('id', params.jobId)
      .eq('account_id', params.accountId)
      .eq('project_type', DELIVERY_PROJECT_FILTER.project_type);

    if (error) this.throwErr(error);
    queueBrainDeleteSource(params.jobId);
  }

  async listJobAssignments(params: ListJobAssignmentsInput) {
    await this.ensureUser();

    const { data, error } = await this.db
      .from(PROJECT_ASSIGNMENTS_TABLE)
      .select('user_id, role_on_project')
      .eq('account_id', params.accountId)
      .eq('project_id', params.jobId)
      .order('user_id', { ascending: true });

    if (error) this.throwErr(error);
    return (data ?? []).map(
      (row: { user_id: string; role_on_project: string | null }) => ({
        user_id: row.user_id,
        role_on_job: row.role_on_project,
      }),
    );
  }

  async addJobAssignment(input: AddJobAssignmentInput) {
    await this.ensureUserAndPermission(input.accountId, 'jobs.edit');

    const { data, error } = await this.db
      .from(PROJECT_ASSIGNMENTS_TABLE)
      .insert({
        account_id: input.accountId,
        project_id: input.jobId,
        user_id: input.userId,
        role_on_project: input.role_on_job ?? null,
      })
      .select()
      .single();

    if (error) this.throwErr(error);
    return data;
  }

  async removeJobAssignment(input: RemoveJobAssignmentInput) {
    await this.ensureUserAndPermission(input.accountId, 'jobs.edit');

    const { error } = await this.db
      .from(PROJECT_ASSIGNMENTS_TABLE)
      .delete()
      .eq('project_id', input.jobId)
      .eq('user_id', input.userId);

    if (error) this.throwErr(error);
  }

  async listJobNotes(params: ListJobNotesInput) {
    await this.ensureUser();

    const { data, error } = await this.db
      .from(PROJECT_DELIVERY_NOTES_TABLE)
      .select('*')
      .eq('project_id', params.jobId)
      .eq('account_id', params.accountId)
      .order('created_at', { ascending: false });

    if (error) this.throwErr(error);
    return data ?? [];
  }

  async addJobNote(input: AddJobNoteInput) {
    const user = await this.ensureUser();
    const api = createTeamAccountsApi(this.client);
    const hasEdit = await api.hasPermission({
      userId: user.id,
      accountId: input.accountId,
      permission: 'jobs.edit',
    });
    const assigned = await this.isAssignedToJob(input.accountId, input.jobId);

    if (!hasEdit && !assigned) {
      throw new Error('You can only add notes to jobs you are assigned to');
    }

    const { data, error } = await this.db
      .from(PROJECT_DELIVERY_NOTES_TABLE)
      .insert({
        account_id: input.accountId,
        project_id: input.jobId,
        author_user_id: user.id,
        note: input.note,
      })
      .select()
      .single();

    if (error) this.throwErr(error);
    queueBrainIndexSource(input.accountId, 'job_note', data.id as string);
    return data;
  }

  async deleteJobNote(params: DeleteJobNoteInput) {
    await this.ensureUser();

    const { data: note, error: fetchError } = await this.db
      .from(PROJECT_DELIVERY_NOTES_TABLE)
      .select('account_id')
      .eq('id', params.noteId)
      .single();
    if (fetchError || !note) throw new Error('Note not found');
    if (note.account_id !== params.accountId) {
      throw new Error('Note not found');
    }

    await this.ensureOwnerOrAdmin(params.accountId);

    const { error } = await this.db
      .from(PROJECT_DELIVERY_NOTES_TABLE)
      .delete()
      .eq('id', params.noteId)
      .eq('account_id', params.accountId);

    if (error) this.throwErr(error);
    queueBrainDeleteSource(params.noteId);
  }
}
