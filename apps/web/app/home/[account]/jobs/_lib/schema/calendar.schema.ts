import { z } from 'zod';

/** Unified calendar item shape (normalized from job_events and jobs). */
export type CalendarItem = {
  id: string;
  source_type: 'job_event' | 'job_deadline';
  source_id: string;
  title: string;
  start_at: string;
  end_at?: string;
  all_day: boolean;
  job_id?: string;
  client_id?: string;
  status?: string;
  priority?: string;
  /** job_event only */
  event_type?: 'site_visit' | 'meeting';
  location?: string | null;
};

export const GetJobCalendarItemsSchema = z.object({
  accountId: z.string().uuid(),
  jobId: z.string().uuid(),
  start: z.string().min(1),
  end: z.string().min(1),
});

export const GetOrgCalendarItemsSchema = z.object({
  accountId: z.string().uuid(),
  start: z.string().min(1),
  end: z.string().min(1),
});

export const GetCalendarItemDetailsSchema = z.object({
  accountId: z.string().uuid(),
  source_type: z.enum(['job_event', 'job_deadline']),
  source_id: z.string().uuid(),
});

export type GetJobCalendarItemsInput = z.infer<typeof GetJobCalendarItemsSchema>;
export type GetOrgCalendarItemsInput = z.infer<typeof GetOrgCalendarItemsSchema>;
export type GetCalendarItemDetailsInput = z.infer<typeof GetCalendarItemDetailsSchema>;
