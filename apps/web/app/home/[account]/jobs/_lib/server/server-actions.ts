'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { createCalendarService } from './calendar.service';
import { createJobEventsService } from './job-events.service';
import { createJobsService } from './jobs.service';
import {
  AddJobEventAssignmentSchema,
  CreateJobEventSchema,
  DeleteJobEventSchema,
  GetJobEventSchema,
  ListJobEventAssignmentsForJobSchema,
  ListJobEventAssignmentsSchema,
  ListJobEventsSchema,
  RemoveJobEventAssignmentSchema,
  SetJobEventAssignmentsSchema,
  UpdateJobEventSchema,
} from '../schema/job-events.schema';
import {
  AddJobAssignmentSchema,
  AddJobNoteSchema,
  CreateJobSchema,
  DeleteJobNoteSchema,
  DeleteJobSchema,
  GetJobSchema,
  ListAccountMembersSchema,
  ListJobAssignmentsSchema,
  ListJobsSchema,
  ListJobNotesSchema,
  RemoveJobAssignmentSchema,
  UpdateJobSchema,
} from '../schema/jobs.schema';
import {
  GetCalendarItemDetailsSchema,
  GetJobCalendarItemsSchema,
  GetOrgCalendarItemsSchema,
} from '../schema/calendar.schema';

function getService() {
  return createJobsService(getSupabaseServerClient());
}

function getJobEventsService() {
  return createJobEventsService(getSupabaseServerClient());
}

function getCalendarService() {
  return createCalendarService(getSupabaseServerClient());
}

export const listAccountMembers = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const { data, error } = await client.rpc('get_account_members', {
      account_slug: input.accountSlug,
    });
    if (error) throw error;
    return data ?? [];
  },
  { schema: ListAccountMembersSchema },
);

export const listJobs = enhanceAction(
  async (input) => {
    const service = getService();
    return service.listJobs(input);
  },
  { schema: ListJobsSchema },
);

export const getJob = enhanceAction(
  async (input) => {
    const service = getService();
    return service.getJob(input);
  },
  { schema: GetJobSchema },
);

export const createJob = enhanceAction(
  async (input) => {
    const service = getService();
    return service.createJob(input);
  },
  { schema: CreateJobSchema },
);

export const updateJob = enhanceAction(
  async (input) => {
    const service = getService();
    return service.updateJob(input);
  },
  { schema: UpdateJobSchema },
);

export const deleteJob = enhanceAction(
  async (input) => {
    const service = getService();
    return service.deleteJob(input);
  },
  { schema: DeleteJobSchema },
);

export const listJobAssignments = enhanceAction(
  async (input) => {
    const service = getService();
    return service.listJobAssignments(input);
  },
  { schema: ListJobAssignmentsSchema },
);

export const addJobAssignment = enhanceAction(
  async (input) => {
    const service = getService();
    return service.addJobAssignment(input);
  },
  { schema: AddJobAssignmentSchema },
);

export const removeJobAssignment = enhanceAction(
  async (input) => {
    const service = getService();
    return service.removeJobAssignment(input);
  },
  { schema: RemoveJobAssignmentSchema },
);

export const listJobNotes = enhanceAction(
  async (input) => {
    const service = getService();
    return service.listJobNotes(input);
  },
  { schema: ListJobNotesSchema },
);

export const addJobNote = enhanceAction(
  async (input) => {
    const service = getService();
    return service.addJobNote(input);
  },
  { schema: AddJobNoteSchema },
);

export const deleteJobNote = enhanceAction(
  async (input) => {
    const service = getService();
    return service.deleteJobNote(input);
  },
  { schema: DeleteJobNoteSchema },
);

// --- Job events (Visits & Meetings) ---
export const listJobEvents = enhanceAction(
  async (input) => {
    const service = getJobEventsService();
    return service.listJobEvents(input);
  },
  { schema: ListJobEventsSchema },
);

export const getJobEvent = enhanceAction(
  async (input) => {
    const service = getJobEventsService();
    return service.getJobEvent(input);
  },
  { schema: GetJobEventSchema },
);

export const createJobEvent = enhanceAction(
  async (input) => {
    const service = getJobEventsService();
    return service.createJobEvent(input);
  },
  { schema: CreateJobEventSchema },
);

export const updateJobEvent = enhanceAction(
  async (input) => {
    const service = getJobEventsService();
    return service.updateJobEvent(input);
  },
  { schema: UpdateJobEventSchema },
);

export const deleteJobEvent = enhanceAction(
  async (input) => {
    const service = getJobEventsService();
    return service.deleteJobEvent(input);
  },
  { schema: DeleteJobEventSchema },
);

export const listJobEventAssignments = enhanceAction(
  async (input) => {
    const service = getJobEventsService();
    return service.listJobEventAssignments(input);
  },
  { schema: ListJobEventAssignmentsSchema },
);

export const listJobEventAssignmentsForJob = enhanceAction(
  async (input) => {
    const service = getJobEventsService();
    return service.listJobEventAssignmentsForJob(input);
  },
  { schema: ListJobEventAssignmentsForJobSchema },
);

export const addJobEventAssignment = enhanceAction(
  async (input) => {
    const service = getJobEventsService();
    return service.addJobEventAssignment(input);
  },
  { schema: AddJobEventAssignmentSchema },
);

export const removeJobEventAssignment = enhanceAction(
  async (input) => {
    const service = getJobEventsService();
    return service.removeJobEventAssignment(input);
  },
  { schema: RemoveJobEventAssignmentSchema },
);

export const setJobEventAssignments = enhanceAction(
  async (input) => {
    const service = getJobEventsService();
    return service.setJobEventAssignments(input);
  },
  { schema: SetJobEventAssignmentsSchema },
);

export const getJobCalendarItems = enhanceAction(
  async (input) => {
    const service = getCalendarService();
    return service.getJobCalendarItems(input);
  },
  { schema: GetJobCalendarItemsSchema },
);

export const getOrgCalendarItems = enhanceAction(
  async (input) => {
    const service = getCalendarService();
    return service.getOrgCalendarItems(input);
  },
  { schema: GetOrgCalendarItemsSchema },
);

export const getCalendarItemDetails = enhanceAction(
  async (input) => {
    const service = getCalendarService();
    return service.getCalendarItemDetails(input);
  },
  { schema: GetCalendarItemDetailsSchema },
);
