'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { undoRetainerBurn } from '~/lib/retainers/apply-match';

import {
  AddCustomProjectRetainerServiceSchema,
  AdjustProjectRetainerBalanceSchema,
  LoadProjectRetainerSchema,
  ReplaceProjectRetainerServicesSchema,
  ResetProjectRetainerServicesSchema,
  UndoTaskRetainerBurnSchema,
  UpdateProjectRetainerSettingsSchema,
} from '../schema/project-retainer.schema';
import { createProjectRetainerService } from './project-retainer.service';

function getService() {
  return createProjectRetainerService(getSupabaseServerClient());
}

export const loadProjectRetainerAction = enhanceAction(
  async (input) =>
    getService().load(input.accountId, input.projectId, input.clientId),
  { auth: true, schema: LoadProjectRetainerSchema },
);

export const updateProjectRetainerSettingsAction = enhanceAction(
  async (input) => {
    const result = await getService().updateSettings(input);
    revalidatePath('/home/[account]/projects/[id]', 'page');
    return result;
  },
  { auth: true, schema: UpdateProjectRetainerSettingsSchema },
);

export const adjustProjectRetainerBalanceAction = enhanceAction(
  async (input) => {
    const result = await getService().adjustBalance(input);
    revalidatePath('/home/[account]/projects/[id]', 'page');
    return result;
  },
  { auth: true, schema: AdjustProjectRetainerBalanceSchema },
);

export const replaceProjectRetainerServicesAction = enhanceAction(
  async (input) => {
    const result = await getService().replaceServices({
      accountId: input.accountId,
      projectId: input.projectId,
      clientId: input.clientId,
      services: input.services.map((row) => ({
        id: row.id,
        sourceServiceId: null,
        name: row.name,
        description: row.description ?? null,
        creditCost: row.creditCost,
        requestTypeId: row.requestTypeId ?? null,
        isActive: row.isActive,
        sortOrder: row.sortOrder,
        scope: 'project',
      })),
    });
    revalidatePath('/home/[account]/projects/[id]', 'page');
    return result;
  },
  { auth: true, schema: ReplaceProjectRetainerServicesSchema },
);

export const resetProjectRetainerServicesAction = enhanceAction(
  async (input) => {
    const result = await getService().resetServices(input);
    revalidatePath('/home/[account]/projects/[id]', 'page');
    return result;
  },
  { auth: true, schema: ResetProjectRetainerServicesSchema },
);

export const addCustomProjectRetainerServiceAction = enhanceAction(
  async (input) => {
    const result = await getService().addCustom(input);
    revalidatePath('/home/[account]/projects/[id]', 'page');
    return result;
  },
  { auth: true, schema: AddCustomProjectRetainerServiceSchema },
);

export const undoTaskRetainerBurnAction = enhanceAction(
  async (input, user) => {
    const userClient = getSupabaseServerClient();
    const { data: task, error } = await userClient
      .from('tasks')
      .select('id')
      .eq('id', input.taskId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!task) throw new Error('Task not found or access denied');

    const result = await undoRetainerBurn({
      admin: getSupabaseServerAdminClient(),
      taskId: input.taskId,
      actorUserId: user.id,
    });
    revalidatePath('/home/[account]/projects/[id]', 'page');
    return result;
  },
  { auth: true, schema: UndoTaskRetainerBurnSchema },
);
