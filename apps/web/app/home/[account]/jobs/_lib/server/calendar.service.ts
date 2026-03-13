import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';

import { Database } from '~/lib/database.types';

import type { CalendarItem } from '../schema/calendar.schema';
import type {
  GetCalendarItemDetailsInput,
  GetJobCalendarItemsInput,
  GetOrgCalendarItemsInput,
} from '../schema/calendar.schema';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export function createCalendarService(client: SupabaseClient<Database>) {
  return new CalendarService(client);
}

class CalendarService {
  constructor(private readonly client: SupabaseClient<Database>) {}

  private get db(): Db {
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

  /** Calendar items for a single job: events + job deadline (and start date if in range). */
  async getJobCalendarItems(params: GetJobCalendarItemsInput): Promise<CalendarItem[]> {
    await this.ensureUser();
    const { accountId, jobId, start, end } = params;
    const items: CalendarItem[] = [];

    const { data: events, error: eventsErr } = await this.db
      .from('job_events')
      .select('id, job_id, client_id, title, event_type, scheduled_start_at, scheduled_end_at, location')
      .eq('account_id', accountId)
      .eq('job_id', jobId)
      .gte('scheduled_start_at', start)
      .lte('scheduled_start_at', end);

    if (eventsErr) this.throwErr(eventsErr);
    const eventList = (events ?? []) as Array<{
      id: string;
      job_id: string;
      client_id: string | null;
      title: string;
      event_type: string;
      scheduled_start_at: string;
      scheduled_end_at: string | null;
      location: string | null;
    }>;
    for (const e of eventList) {
      items.push({
        id: e.id,
        source_type: 'job_event',
        source_id: e.id,
        title: e.title,
        start_at: e.scheduled_start_at,
        end_at: e.scheduled_end_at ?? undefined,
        all_day: false,
        job_id: e.job_id,
        client_id: e.client_id ?? undefined,
        event_type: e.event_type as 'site_visit' | 'meeting',
        location: e.location,
      });
    }

    const { data: job, error: jobErr } = await this.db
      .from('jobs')
      .select('id, title, due_date, start_date, status, priority, client_id')
      .eq('id', jobId)
      .eq('account_id', accountId)
      .single();

    if (!jobErr && job) {
      const j = job as {
        id: string;
        title: string;
        due_date: string | null;
        start_date: string | null;
        status: string;
        priority: string | null;
        client_id: string | null;
      };
      const startDate = start.slice(0, 10);
      const endDate = end.slice(0, 10);
      if (j.due_date) {
        const d = j.due_date.slice(0, 10);
        if (d >= startDate && d <= endDate) {
          items.push({
            id: `job-deadline-${j.id}`,
            source_type: 'job_deadline',
            source_id: j.id,
            title: `Due: ${j.title}`,
            start_at: `${j.due_date.slice(0, 10)}T12:00:00.000Z`,
            end_at: undefined,
            all_day: true,
            job_id: j.id,
            client_id: j.client_id ?? undefined,
            status: j.status,
            priority: j.priority ?? undefined,
          });
        }
      }
      if (j.start_date) {
        const d = j.start_date.slice(0, 10);
        if (d >= startDate && d <= endDate) {
          items.push({
            id: `job-start-${j.id}`,
            source_type: 'job_deadline',
            source_id: j.id,
            title: `Start: ${j.title}`,
            start_at: `${j.start_date.slice(0, 10)}T09:00:00.000Z`,
            end_at: undefined,
            all_day: true,
            job_id: j.id,
            client_id: j.client_id ?? undefined,
            status: j.status,
            priority: j.priority ?? undefined,
          });
        }
      }
    }

    return items;
  }

  /** Calendar items for the whole org: all job_events + all job due/start dates in range. */
  async getOrgCalendarItems(params: GetOrgCalendarItemsInput): Promise<CalendarItem[]> {
    await this.ensureUser();
    const { accountId, start, end } = params;
    const items: CalendarItem[] = [];

    const { data: events, error: eventsErr } = await this.db
      .from('job_events')
      .select('id, job_id, client_id, title, event_type, scheduled_start_at, scheduled_end_at, location')
      .eq('account_id', accountId)
      .gte('scheduled_start_at', start)
      .lte('scheduled_start_at', end);

    if (eventsErr) this.throwErr(eventsErr);
    const eventList = (events ?? []) as Array<{
      id: string;
      job_id: string;
      client_id: string | null;
      title: string;
      event_type: string;
      scheduled_start_at: string;
      scheduled_end_at: string | null;
      location: string | null;
    }>;
    for (const e of eventList) {
      items.push({
        id: e.id,
        source_type: 'job_event',
        source_id: e.id,
        title: e.title,
        start_at: e.scheduled_start_at,
        end_at: e.scheduled_end_at ?? undefined,
        all_day: false,
        job_id: e.job_id,
        client_id: e.client_id ?? undefined,
        event_type: e.event_type as 'site_visit' | 'meeting',
        location: e.location,
      });
    }

    const startDate = start.slice(0, 10);
    const endDate = end.slice(0, 10);
    const { data: jobs, error: jobsErr } = await this.db
      .from('jobs')
      .select('id, title, due_date, start_date, status, priority, client_id')
      .eq('account_id', accountId)
      .or(`due_date.gte.${startDate},start_date.gte.${startDate}`);

    if (jobsErr) this.throwErr(jobsErr);
    const jobList = (jobs ?? []) as Array<{
      id: string;
      title: string;
      due_date: string | null;
      start_date: string | null;
      status: string;
      priority: string | null;
      client_id: string | null;
    }>;
    const seenDeadline = new Set<string>();
    const seenStart = new Set<string>();
    for (const j of jobList) {
      if (j.due_date) {
        const d = j.due_date.slice(0, 10);
        if (d >= startDate && d <= endDate && !seenDeadline.has(j.id)) {
          seenDeadline.add(j.id);
          items.push({
            id: `job-deadline-${j.id}`,
            source_type: 'job_deadline',
            source_id: j.id,
            title: `Due: ${j.title}`,
            start_at: `${d}T12:00:00.000Z`,
            end_at: undefined,
            all_day: true,
            job_id: j.id,
            client_id: j.client_id ?? undefined,
            status: j.status,
            priority: j.priority ?? undefined,
          });
        }
      }
      if (j.start_date) {
        const d = j.start_date.slice(0, 10);
        if (d >= startDate && d <= endDate && !seenStart.has(j.id)) {
          seenStart.add(j.id);
          items.push({
            id: `job-start-${j.id}`,
            source_type: 'job_deadline',
            source_id: j.id,
            title: `Start: ${j.title}`,
            start_at: `${d}T09:00:00.000Z`,
            end_at: undefined,
            all_day: true,
            job_id: j.id,
            client_id: j.client_id ?? undefined,
            status: j.status,
            priority: j.priority ?? undefined,
          });
        }
      }
    }

    return items;
  }

  /** Full details for the details panel (event or job). */
  async getCalendarItemDetails(params: GetCalendarItemDetailsInput): Promise<Record<string, unknown>> {
    await this.ensureUser();
    const { accountId, source_type, source_id } = params;

    if (source_type === 'job_event') {
      const { data, error } = await this.db
        .from('job_events')
        .select('*')
        .eq('id', source_id)
        .eq('account_id', accountId)
        .single();
      if (error) this.throwErr(error);
      if (!data) throw new Error('Event not found');
      return data as Record<string, unknown>;
    }

    const { data, error } = await this.db
      .from('jobs')
      .select('*')
      .eq('id', source_id)
      .eq('account_id', accountId)
      .single();
    if (error) this.throwErr(error);
    if (!data) throw new Error('Job not found');
    return data as Record<string, unknown>;
  }
}
