'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

import {
  AddProjectContactSchema,
  AddProjectMemberSchema,
  CreateProjectContactSchema,
  RemoveProjectContactSchema,
  RemoveProjectMemberSchema,
  SearchProjectContactsSchema,
  UpdateProjectContactSchema,
  UpdateProjectMemberSchema,
} from '../schema/project-team.schema';
import { createProjectTeamService } from './project-team.service';

function getService() {
  return createProjectTeamService(getSupabaseServerClient());
}

function revalidateProject(input: { accountSlug: string; jobId: string }) {
  revalidatePath(
    pathsConfig.app.accountJobDetail
      .replace('[account]', input.accountSlug)
      .replace('[id]', input.jobId),
  );
}

export const addProjectMember = enhanceAction(
  async (input) => {
    await getService().addMember(input);
    revalidateProject(input);
  },
  { schema: AddProjectMemberSchema },
);

export const updateProjectMember = enhanceAction(
  async (input) => {
    await getService().updateMember(input);
    revalidateProject(input);
  },
  { schema: UpdateProjectMemberSchema },
);

export const removeProjectMember = enhanceAction(
  async (input) => {
    await getService().removeMember(input);
    revalidateProject(input);
  },
  { schema: RemoveProjectMemberSchema },
);

export const addProjectContact = enhanceAction(
  async (input) => {
    await getService().addContact(input);
    revalidateProject(input);
  },
  { schema: AddProjectContactSchema },
);

export const createProjectContact = enhanceAction(
  async (input) => {
    const result = await getService().createContact(input);
    revalidateProject(input);
    return result;
  },
  { schema: CreateProjectContactSchema },
);

export const updateProjectContact = enhanceAction(
  async (input) => {
    await getService().updateContact(input);
    revalidateProject(input);
  },
  { schema: UpdateProjectContactSchema },
);

export const removeProjectContact = enhanceAction(
  async (input) => {
    await getService().removeContact(input);
    revalidateProject(input);
  },
  { schema: RemoveProjectContactSchema },
);

export const searchProjectContacts = enhanceAction(
  async (input) => getService().searchContacts(input),
  { schema: SearchProjectContactsSchema },
);
