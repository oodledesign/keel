'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

import { createCalendarService } from './calendar.service';
import { createJobEventsService } from './job-events.service';
import { createJobsService } from './jobs.service';
import { createProjectPhasesService } from './project-phases.service';
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
import {
  ApplyPhaseTemplateSchema,
  CreatePhaseSchema,
  CreateJobTaskSchema,
  AddPhaseNoteSchema,
  DeletePhaseSchema,
  EnsurePhasePageSchema,
  GetPhaseDetailSchema,
  ListJobBoardSchema,
  ListPhaseTemplatesSchema,
  ListPhasesForJobSchema,
  MoveTaskSchema,
  ReorderPhasesSchema,
  SavePhasePageDocSchema,
  UpdatePhaseSchema,
  UpdateJobTaskSchema,
  UpdatePhaseNoteSchema,
} from '../schema/project-phases.schema';

function getService() {
  return createJobsService(getSupabaseServerClient());
}

function getProjectPhasesService() {
  return createProjectPhasesService(getSupabaseServerClient());
}

function jobDetailPath(accountSlug: string, jobId: string) {
  return pathsConfig.app.accountJobDetail
    .replace('[account]', accountSlug)
    .replace('[id]', jobId);
}

function phaseDetailPath(accountSlug: string, jobId: string, phaseId: string) {
  return pathsConfig.app.accountJobPhaseDetail
    .replace('[account]', accountSlug)
    .replace('[id]', jobId)
    .replace('[phaseId]', phaseId);
}

function revalidatePhasePaths(
  accountSlug: string,
  jobId: string,
  phaseId: string,
) {
  revalidatePath(jobDetailPath(accountSlug, jobId));
  revalidatePath(phaseDetailPath(accountSlug, jobId, phaseId));
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

// --- Project phases (delivery board / timeline) ---

export const createPhase = enhanceAction(
  async (input) => {
    const service = getProjectPhasesService();
    const phase = await service.createPhase(input);
    revalidatePath(jobDetailPath(input.accountSlug, input.jobId));
    return phase;
  },
  { schema: CreatePhaseSchema },
);

export const updatePhase = enhanceAction(
  async (input) => {
    const service = getProjectPhasesService();
    const phase = await service.updatePhase(input);
    revalidatePhasePaths(input.accountSlug, input.jobId, input.phaseId);
    return phase;
  },
  { schema: UpdatePhaseSchema },
);

export const deletePhase = enhanceAction(
  async (input) => {
    const service = getProjectPhasesService();
    await service.deletePhase(input);
    revalidatePath(jobDetailPath(input.accountSlug, input.jobId));
  },
  { schema: DeletePhaseSchema },
);

export const reorderPhases = enhanceAction(
  async (input) => {
    const service = getProjectPhasesService();
    await service.reorderPhases(input);
    revalidatePath(jobDetailPath(input.accountSlug, input.jobId));
  },
  { schema: ReorderPhasesSchema },
);

export const listPhasesForJob = enhanceAction(
  async (input) => {
    const service = getProjectPhasesService();
    return service.listPhasesForJob(input);
  },
  { schema: ListPhasesForJobSchema },
);

export const moveTask = enhanceAction(
  async (input) => {
    const service = getProjectPhasesService();
    const task = await service.moveTask(input);
    revalidatePath(jobDetailPath(input.accountSlug, input.jobId));
    return task;
  },
  { schema: MoveTaskSchema },
);

export const listJobBoard = enhanceAction(
  async (input) => {
    const service = getProjectPhasesService();
    return service.listJobBoard(input);
  },
  { schema: ListJobBoardSchema },
);

export const ensurePhasePage = enhanceAction(
  async (input) => {
    const service = getProjectPhasesService();
    return service.ensurePhasePage(input);
  },
  { schema: EnsurePhasePageSchema },
);

export const getPhaseDetail = enhanceAction(
  async (input) => {
    const service = getProjectPhasesService();
    return service.getPhaseDetail(input);
  },
  { schema: GetPhaseDetailSchema },
);

export const createJobTask = enhanceAction(
  async (input) => {
    const service = getProjectPhasesService();
    const task = await service.createJobTask(input);
    revalidatePath(jobDetailPath(input.accountSlug, input.jobId));
    if (input.phaseId) {
      revalidatePhasePaths(input.accountSlug, input.jobId, input.phaseId);
    }
    return task;
  },
  { schema: CreateJobTaskSchema },
);

export const updateJobTask = enhanceAction(
  async (input) => {
    const service = getProjectPhasesService();
    const task = await service.updateJobTask(input);
    revalidatePath(jobDetailPath(input.accountSlug, input.jobId));
    if (task.phase_id) {
      revalidatePhasePaths(input.accountSlug, input.jobId, task.phase_id);
    }
    return task;
  },
  { schema: UpdateJobTaskSchema },
);

export const savePhasePageDoc = enhanceAction(
  async (input) => {
    const service = getProjectPhasesService();
    const doc = await service.savePhasePageDoc(input);
    revalidatePhasePaths(input.accountSlug, input.jobId, input.phaseId);
    return doc;
  },
  { schema: SavePhasePageDocSchema },
);

export const addPhaseNote = enhanceAction(
  async (input) => {
    const service = getProjectPhasesService();
    const note = await service.addPhaseNote(input);
    revalidatePhasePaths(input.accountSlug, input.jobId, input.phaseId);
    return note;
  },
  { schema: AddPhaseNoteSchema },
);

export const updatePhaseNote = enhanceAction(
  async (input) => {
    const service = getProjectPhasesService();
    const note = await service.updatePhaseNote(input);
    revalidatePhasePaths(input.accountSlug, input.jobId, input.phaseId);
    return note;
  },
  { schema: UpdatePhaseNoteSchema },
);

export const listPhaseTemplates = enhanceAction(
  async (input) => {
    const service = getProjectPhasesService();
    return service.listPhaseTemplates(input);
  },
  { schema: ListPhaseTemplatesSchema },
);

export const applyPhaseTemplate = enhanceAction(
  async (input) => {
    const service = getProjectPhasesService();
    const result = await service.applyPhaseTemplate(input);
    revalidatePath(jobDetailPath(input.accountSlug, input.jobId));
    return result;
  },
  { schema: ApplyPhaseTemplateSchema },
);
