'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import {
  CreateWorkspaceFormSchema,
  DeleteWorkspaceFormSchema,
  PublishWorkspaceFormSchema,
  UpdateWorkspaceFormSchema,
} from '~/lib/workspace-forms/form.schema';

import { createWorkspaceFormsService } from './workspace-forms.service';

function formsPath(accountSlug?: string | null) {
  if (!accountSlug) return pathsConfig.app.accountForms;
  return pathsConfig.app.accountForms.replace('[account]', accountSlug);
}

export const createWorkspaceFormAction = enhanceAction(
  async function (data, user) {
    const logger = await getLogger();
    const ctx = { name: 'create-workspace-form', userId: user.id };
    logger.info(ctx, 'Creating workspace form');

    const client = getSupabaseServerClient();
    const service = createWorkspaceFormsService(client);
    const result = await service.createForm(data);

    logger.info({ ...ctx, formId: result.id }, 'Workspace form created');
    revalidatePath(pathsConfig.app.accountForms);

    return { success: true as const, data: result };
  },
  {
    auth: true,
    schema: CreateWorkspaceFormSchema,
  },
);

export const updateWorkspaceFormAction = enhanceAction(
  async function (data, user) {
    const logger = await getLogger();
    const ctx = {
      name: 'update-workspace-form',
      userId: user.id,
      formId: data.formId,
    };
    logger.info(ctx, 'Updating workspace form');

    const client = getSupabaseServerClient();
    const service = createWorkspaceFormsService(client);
    const result = await service.updateForm(data);

    logger.info(ctx, 'Workspace form updated');
    revalidatePath(pathsConfig.app.accountForms);
    revalidatePath(pathsConfig.app.accountFormDetail);

    return { success: true as const, data: result };
  },
  {
    auth: true,
    schema: UpdateWorkspaceFormSchema,
  },
);

export const publishWorkspaceFormAction = enhanceAction(
  async function (data, user) {
    const logger = await getLogger();
    logger.info(
      { name: 'publish-workspace-form', userId: user.id, formId: data.formId },
      data.enabled
        ? 'Publishing workspace form'
        : 'Unpublishing workspace form',
    );

    const client = getSupabaseServerClient();
    const service = createWorkspaceFormsService(client);
    const result = await service.setPublished(data);

    revalidatePath(pathsConfig.app.accountForms);
    revalidatePath(pathsConfig.app.accountFormDetail);

    return { success: true as const, data: result };
  },
  {
    auth: true,
    schema: PublishWorkspaceFormSchema,
  },
);

export const deleteWorkspaceFormAction = enhanceAction(
  async function (data, user) {
    const logger = await getLogger();
    logger.info(
      { name: 'delete-workspace-form', userId: user.id, formId: data.formId },
      'Deleting workspace form',
    );

    const client = getSupabaseServerClient();
    const service = createWorkspaceFormsService(client);
    await service.deleteForm(data.accountId, data.formId);

    revalidatePath(formsPath());

    return { success: true as const };
  },
  {
    auth: true,
    schema: DeleteWorkspaceFormSchema,
  },
);
