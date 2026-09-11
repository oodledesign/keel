'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

import {
  CreateProjectStatusSchema,
  DeleteProjectStatusSchema,
  ListProjectStatusesSchema,
  ReorderProjectStatusesSchema,
  UpdateProjectStatusSchema,
} from '../schema/project-statuses.schema';
import { createProjectStatusesService } from './project-statuses.service';

function getService() {
  return createProjectStatusesService(getSupabaseServerClient());
}

function revalidateStatusPaths(accountSlug?: string) {
  if (!accountSlug) {
    revalidatePath(pathsConfig.app.accountProjects, 'layout');
    revalidatePath(pathsConfig.app.accountSettings, 'layout');
    return;
  }

  revalidatePath(
    pathsConfig.app.accountProjects.replace('[account]', accountSlug),
  );
  revalidatePath(
    pathsConfig.app.accountProjectStatusesSettings.replace(
      '[account]',
      accountSlug,
    ),
  );
}

export const listProjectStatuses = enhanceAction(
  async (input) => {
    return getService().list(input.accountId);
  },
  { auth: true, schema: ListProjectStatusesSchema },
);

export const createProjectStatus = enhanceAction(
  async function (data, user) {
    const logger = await getLogger();
    logger.info(
      {
        name: 'create-project-status',
        userId: user.id,
        accountId: data.accountId,
      },
      'Creating project status',
    );

    const result = await getService().create(data);
    revalidateStatusPaths(data.accountSlug);
    return result;
  },
  { auth: true, schema: CreateProjectStatusSchema },
);

export const updateProjectStatus = enhanceAction(
  async function (data, user) {
    const logger = await getLogger();
    logger.info(
      { name: 'update-project-status', userId: user.id, statusId: data.id },
      'Updating project status',
    );

    const result = await getService().update(data);
    revalidateStatusPaths(data.accountSlug);
    return result;
  },
  { auth: true, schema: UpdateProjectStatusSchema },
);

export const reorderProjectStatuses = enhanceAction(
  async function (data, user) {
    const logger = await getLogger();
    logger.info(
      {
        name: 'reorder-project-statuses',
        userId: user.id,
        accountId: data.accountId,
      },
      'Reordering project statuses',
    );

    const result = await getService().reorder(data);
    revalidateStatusPaths(data.accountSlug);
    return result;
  },
  { auth: true, schema: ReorderProjectStatusesSchema },
);

export const deleteProjectStatus = enhanceAction(
  async function (data, user) {
    const logger = await getLogger();
    logger.info(
      { name: 'delete-project-status', userId: user.id, statusId: data.id },
      'Deleting project status',
    );

    await getService().delete(data);
    revalidateStatusPaths(data.accountSlug);
    return { success: true };
  },
  { auth: true, schema: DeleteProjectStatusSchema },
);
