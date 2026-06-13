'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

import {
  ApplyProjectPhasePlanSchema,
  GenerateProjectContentSchema,
  ListProjectAiSourcesSchema,
} from '../schema/project-ai.schema';
import { createProjectAiService } from './project-ai.service';

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

function docDetailPath(accountSlug: string, docId: string) {
  return pathsConfig.app.accountDocDetail
    .replace('[account]', accountSlug)
    .replace('[docId]', docId);
}

function getService() {
  return createProjectAiService(getSupabaseServerClient());
}

export const listProjectAiSources = enhanceAction(
  async (input) => {
    const service = getService();
    return service.listProjectAiSources(input);
  },
  { schema: ListProjectAiSourcesSchema },
);

export const generateProjectContent = enhanceAction(
  async (input) => {
    const service = getService();
    const result = await service.generateProjectContent(input);

    revalidatePath(jobDetailPath(input.accountSlug, input.jobId));

    if (result.mode === 'brief') {
      revalidatePath(docDetailPath(input.accountSlug, result.docId));
    }
    if (result.mode === 'phase_page' && input.phaseId) {
      revalidatePath(
        phaseDetailPath(input.accountSlug, input.jobId, input.phaseId),
      );
    }

    return result;
  },
  { schema: GenerateProjectContentSchema },
);

export const applyProjectPhasePlan = enhanceAction(
  async (input) => {
    const service = getService();
    const result = await service.applyProjectPhasePlan(input);
    revalidatePath(jobDetailPath(input.accountSlug, input.jobId));
    return result;
  },
  { schema: ApplyProjectPhasePlanSchema },
);
