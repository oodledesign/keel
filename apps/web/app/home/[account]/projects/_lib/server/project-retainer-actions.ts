'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { undoRetainerBurn } from '~/lib/retainers/apply-match';

import {
  AdjustProjectRetainerBalanceSchema,
  LoadProjectRetainerSchema,
  UndoTaskRetainerBurnSchema,
  UpdateProjectRetainerSettingsSchema,
} from '../schema/project-retainer.schema';
import { createProjectRetainerService } from './project-retainer.service';

function getService() {
  return createProjectRetainerService(getSupabaseServerClient());
}

export const loadProjectRetainerAction = enhanceAction(
  async (input) => getService().load(input.accountId, input.projectId),
  { schema: LoadProjectRetainerSchema },
);

export const updateProjectRetainerSettingsAction = enhanceAction(
  async (input) => {
    const result = await getService().updateSettings(input);
    revalidatePath('/home/[account]/projects/[id]', 'page');
    return result;
  },
  { schema: UpdateProjectRetainerSettingsSchema },
);

export const adjustProjectRetainerBalanceAction = enhanceAction(
  async (input) => {
    const result = await getService().adjustBalance(input);
    revalidatePath('/home/[account]/projects/[id]', 'page');
    return result;
  },
  { schema: AdjustProjectRetainerBalanceSchema },
);

export const undoTaskRetainerBurnAction = enhanceAction(
  async (input, user) => {
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
