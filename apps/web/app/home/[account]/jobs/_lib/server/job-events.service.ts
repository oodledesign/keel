import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

import { Database } from '~/lib/database.types';

import type {
  AddJobEventAssignmentInput,
  CreateJobEventInput,
  DeleteJobEventInput,
  GetJobEventInput,
  ListJobEventAssignmentsForJobInput,
  ListJobEventAssignmentsInput,
  ListJobEventsInput,
  RemoveJobEventAssignmentInput,
  SetJobEventAssignmentsInput,
  UpdateJobEventInput,
} from '../schema/job-events.schema';

type AccountRole = 'owner' | 'admin' | 'staff' | 'contractor' | 'client' | null;

export function createJobEventsService(client: SupabaseClient<Database>) {
  return new JobEventsService(client);
}

 
class JobEventsService {
  constructor(private readonly client: SupabaseClient<Database>) {}

  private get db(): any {
    return this.client;
  }

  private throwErr(err: unknown, fallback = 'Something went wrong'): never {
    if (err instanceof Error) throw err;
    const msg =
      err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
        ? (err as { message: string }).message
        : fallback;
    throw new Error(msg);
  }

  private async ensureUser() {
    const { data: user } = await requireUser(this.client);
    if (!user) throw new Error('Authentication required');
    return user;
  }

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

  private async ensureUserAndPermission(accountId: string, permission: 'jobs.view' | 'jobs.edit') {
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

  private async isAssignedToJob(accountId: string, jobId: string): Promise<boolean> {
    const user = await this.ensureUser();
    const { data, error } = await this.db
      .from('job_assignments')
      .select('id')
      .eq('job_id', jobId)
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) this.throwErr(error);
    return !!data;
  }

  private async isAssignedToEvent(accountId: string, eventId: string): Promise<boolean> {
    const user = await this.ensureUser();
    const { data, error } = await this.db
      .from('job_event_assignments')
      .select('id')
      .eq('job_event_id', eventId)
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) this.throwErr(error);
    return !!data;
  }

  /** Contractor can only update prep_notes and outcome_notes. */
  private contractorNotesOnlyPayload(payload: Record<string, unknown>) {
    const allowed: Record<string, unknown> = {};
    if (payload.prep_notes !== undefined) allowed.prep_notes = payload.prep_notes;
    if (payload.outcome_notes !== undefined) allowed.outcome_notes = payload.outcome_notes;
    return allowed;
  }

  async listJobEvents(params: ListJobEventsInput) {
    await this.ensureUser();

    const { data, error } = await this.db
      .from('job_events')
      .select('*')
      .eq('account_id', params.accountId)
      .eq('job_id', params.jobId)
      .order('scheduled_start_at', { ascending: true });

    if (error) this.throwErr(error);
    const list = (data ?? []) as Array<{ scheduled_start_at: string }>;
    const now = new Date().toISOString();
    const upcoming = list.filter((e) => e.scheduled_start_at >= now);
    const previous = list.filter((e) => e.scheduled_start_at < now);
    return { upcoming, previous };
  }

  async getJobEvent(params: GetJobEventInput) {
    await this.ensureUser();

    const { data, error } = await this.db
      .from('job_events')
      .select('*')
      .eq('id', params.eventId)
      .eq('account_id', params.accountId)
      .single();

    if (error) this.throwErr(error);
    return data;
  }

  async createJobEvent(input: CreateJobEventInput) {
    const user = await this.ensureUserAndPermission(input.accountId, 'jobs.edit');

    const { data, error } = await this.db
      .from('job_events')
      .insert({
        account_id: input.accountId,
        job_id: input.jobId,
        client_id: input.client_id ?? null,
        title: input.title,
        event_type: input.event_type,
        scheduled_start_at: input.scheduled_start_at,
        scheduled_end_at: input.scheduled_end_at ?? null,
        location: input.location ?? null,
        prep_notes: input.prep_notes ?? null,
        outcome_notes: input.outcome_notes ?? null,
        follow_up_required: input.follow_up_required ?? false,
        follow_up_at: input.follow_up_at ?? null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) this.throwErr(error);
    return data;
  }

  async updateJobEvent(input: UpdateJobEventInput) {
    await this.ensureUser();
    const existing = await this.getJobEvent({ accountId: input.accountId, eventId: input.eventId });
    const role = await this.getMembershipRole(input.accountId);
    const hasEdit = role === 'owner' || role === 'admin' || role === 'staff';
    const assignedToJob = await this.isAssignedToJob(input.accountId, existing.job_id);
    const assignedToEvent = await this.isAssignedToEvent(input.accountId, input.eventId);

    if (!hasEdit && !assignedToJob && !assignedToEvent) {
      throw new Error('Permission denied');
    }

    const payload: Record<string, unknown> = {};
    if (input.title !== undefined) payload.title = input.title;
    if (input.event_type !== undefined) payload.event_type = input.event_type;
    if (input.scheduled_start_at !== undefined) payload.scheduled_start_at = input.scheduled_start_at;
    if (input.scheduled_end_at !== undefined) payload.scheduled_end_at = input.scheduled_end_at;
    if (input.location !== undefined) payload.location = input.location;
    if (input.prep_notes !== undefined) payload.prep_notes = input.prep_notes;
    if (input.outcome_notes !== undefined) payload.outcome_notes = input.outcome_notes;
    if (input.follow_up_required !== undefined) payload.follow_up_required = input.follow_up_required;
    if (input.follow_up_at !== undefined) payload.follow_up_at = input.follow_up_at;
    if (input.client_id !== undefined) payload.client_id = input.client_id;

    const toApply = hasEdit ? payload : this.contractorNotesOnlyPayload(payload);
    if (Object.keys(toApply).length === 0) return this.getJobEvent({ accountId: input.accountId, eventId: input.eventId });

    const { data, error } = await this.db
      .from('job_events')
      .update(toApply)
      .eq('id', input.eventId)
      .eq('account_id', input.accountId)
      .select()
      .single();

    if (error) this.throwErr(error);
    return data;
  }

  async deleteJobEvent(params: DeleteJobEventInput) {
    await this.ensureUserAndPermission(params.accountId, 'jobs.edit');

    const { error } = await this.db
      .from('job_events')
      .delete()
      .eq('id', params.eventId)
      .eq('account_id', params.accountId);

    if (error) this.throwErr(error);
  }

  async listJobEventAssignments(params: ListJobEventAssignmentsInput) {
    await this.ensureUser();

    const { data, error } = await this.db
      .from('job_event_assignments')
      .select('*')
      .eq('job_event_id', params.eventId)
      .eq('account_id', params.accountId)
      .order('created_at', { ascending: false });

    if (error) this.throwErr(error);
    return data ?? [];
  }

  /** All assignments for all events of a job (for list view). */
  async listJobEventAssignmentsForJob(params: ListJobEventAssignmentsForJobInput) {
    await this.ensureUser();

    const eventIdsResult = await this.db
      .from('job_events')
      .select('id')
      .eq('account_id', params.accountId)
      .eq('job_id', params.jobId);
    const events = (eventIdsResult.data ?? []) as { id: string }[];
    const ids = events.map((e) => e.id);
    if (ids.length === 0) return [];

    const { data, error } = await this.db
      .from('job_event_assignments')
      .select('job_event_id, user_id, role_on_event')
      .eq('account_id', params.accountId)
      .in('job_event_id', ids);

    if (error) this.throwErr(error);
    return (data ?? []) as { job_event_id: string; user_id: string; role_on_event: string | null }[];
  }

  async addJobEventAssignment(input: AddJobEventAssignmentInput) {
    await this.ensureUserAndPermission(input.accountId, 'jobs.edit');

    const { data: event, error: eventErr } = await this.db
      .from('job_events')
      .select('id, account_id')
      .eq('id', input.eventId)
      .eq('account_id', input.accountId)
      .single();
    if (eventErr) this.throwErr(eventErr);
    if (!event) throw new Error('Event not found');

    const { data, error } = await this.db
      .from('job_event_assignments')
      .insert({
        account_id: input.accountId,
        job_event_id: input.eventId,
        user_id: input.userId,
        role_on_event: input.role_on_event ?? null,
      })
      .select()
      .single();

    if (error) this.throwErr(error);
    return data;
  }

  async removeJobEventAssignment(input: RemoveJobEventAssignmentInput) {
    await this.ensureUserAndPermission(input.accountId, 'jobs.edit');

    const { error } = await this.db
      .from('job_event_assignments')
      .delete()
      .eq('job_event_id', input.eventId)
      .eq('account_id', input.accountId)
      .eq('user_id', input.userId);

    if (error) this.throwErr(error);
  }

  /** Replace all assignments for an event (used when saving the visit/meeting). */
  async setJobEventAssignments(input: SetJobEventAssignmentsInput) {
    await this.ensureUserAndPermission(input.accountId, 'jobs.edit');

    const { error: deleteErr } = await this.db
      .from('job_event_assignments')
      .delete()
      .eq('job_event_id', input.eventId)
      .eq('account_id', input.accountId);

    if (deleteErr) this.throwErr(deleteErr);

    if (input.assignments.length === 0) return [];

    const rows = input.assignments.map((a) => ({
      account_id: input.accountId,
      job_event_id: input.eventId,
      user_id: a.userId,
      role_on_event: a.role_on_event ?? null,
    }));

    const { data, error } = await this.db.from('job_event_assignments').insert(rows).select();
    if (error) this.throwErr(error);
    return data ?? [];
  }
}
