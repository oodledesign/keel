'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

import {
  AddClientToCampaignSchema,
  CreateCampaignProjectSchema,
  CreateProjectFieldSchema,
  DeleteCampaignProjectSchema,
  DeleteProjectFieldSchema,
  GetCampaignProjectSchema,
  ImportWebsiteRevampCampaignSchema,
  ListCampaignProjectsSchema,
  RemoveClientFromCampaignSchema,
  ReorderProjectFieldsSchema,
  UpdateClientFieldValueSchema,
  UpdateProjectFieldSchema,
} from '../schema/campaign-projects.schema';
import { createCampaignProjectsService } from './campaign-projects.service';

function revalidateCampaignPaths(accountSlug: string, projectId?: string) {
  const listPath = pathsConfig.app.accountCampaigns.replace('[account]', accountSlug);
  revalidatePath(listPath);
  if (projectId) {
    const detailPath = pathsConfig.app.accountCampaignDetail
      .replace('[account]', accountSlug)
      .replace('[id]', projectId);
    revalidatePath(detailPath);
  }
}

function getService() {
  return createCampaignProjectsService(getSupabaseServerClient());
}

export const listCampaignProjects = enhanceAction(
  async (input) => getService().listProjects(input),
  { schema: ListCampaignProjectsSchema },
);

export const getCampaignProject = enhanceAction(
  async (input) => getService().getProject(input),
  { schema: GetCampaignProjectSchema },
);

export const createCampaignProject = enhanceAction(
  async (input) => {
    const project = await getService().createProject(input);
    revalidateCampaignPaths(input.accountSlug, project.id);
    return project;
  },
  {
    schema: CreateCampaignProjectSchema.extend({
      accountSlug: z.string().min(1),
    }),
  },
);

export const deleteCampaignProject = enhanceAction(
  async (input) => {
    await getService().deleteProject(input);
    revalidateCampaignPaths(input.accountSlug);
  },
  {
    schema: DeleteCampaignProjectSchema.extend({
      accountSlug: z.string().min(1),
    }),
  },
);

export const createProjectField = enhanceAction(
  async (input) => {
    const field = await getService().createField(input);
    revalidateCampaignPaths(input.accountSlug, input.projectId);
    return field;
  },
  {
    schema: CreateProjectFieldSchema.extend({
      accountSlug: z.string().min(1),
    }),
  },
);

export const updateProjectField = enhanceAction(
  async (input) => {
    const field = await getService().updateField(input);
    revalidateCampaignPaths(input.accountSlug, input.projectId);
    return field;
  },
  {
    schema: UpdateProjectFieldSchema.extend({
      accountSlug: z.string().min(1),
    }),
  },
);

export const deleteProjectField = enhanceAction(
  async (input) => {
    await getService().deleteField(input);
    revalidateCampaignPaths(input.accountSlug, input.projectId);
  },
  {
    schema: DeleteProjectFieldSchema.extend({
      accountSlug: z.string().min(1),
    }),
  },
);

export const reorderProjectFields = enhanceAction(
  async (input) => {
    const fields = await getService().reorderFields(input);
    revalidateCampaignPaths(input.accountSlug, input.projectId);
    return fields;
  },
  {
    schema: ReorderProjectFieldsSchema.extend({
      accountSlug: z.string().min(1),
    }),
  },
);

export const addClientToCampaign = enhanceAction(
  async (input) => {
    await getService().addClient(input);
    revalidateCampaignPaths(input.accountSlug, input.projectId);
  },
  {
    schema: AddClientToCampaignSchema.extend({
      accountSlug: z.string().min(1),
    }),
  },
);

export const removeClientFromCampaign = enhanceAction(
  async (input) => {
    await getService().removeClient(input);
    revalidateCampaignPaths(input.accountSlug, input.projectId);
  },
  {
    schema: RemoveClientFromCampaignSchema.extend({
      accountSlug: z.string().min(1),
    }),
  },
);

export const updateClientFieldValue = enhanceAction(
  async (input) => {
    await getService().updateClientFieldValue(input);
    revalidateCampaignPaths(input.accountSlug, input.projectId);
  },
  {
    schema: UpdateClientFieldValueSchema.extend({
      accountSlug: z.string().min(1),
    }),
  },
);

export const importWebsiteRevampCampaign = enhanceAction(
  async (input) => {
    const project = await getService().importWebsiteRevampCampaign(input.accountId);
    revalidateCampaignPaths(input.accountSlug, project.id);
    return project;
  },
  {
    schema: ImportWebsiteRevampCampaignSchema.extend({
      accountSlug: z.string().min(1),
    }),
  },
);

export const listCampaignLinkOptions = enhanceAction(
  async (input) => getService().listLinkOptions(input.accountId),
  { schema: ListCampaignProjectsSchema },
);
