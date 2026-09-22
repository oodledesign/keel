'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  LinkWorkspaceRetainerToProjectSchema,
  ListWorkspaceRetainersSchema,
} from '../schema/workspace-retainers.schema';
import { createWorkspaceRetainersService } from './workspace-retainers.service';

export const listWorkspaceRetainersAction = enhanceAction(
  async (input) =>
    createWorkspaceRetainersService(getSupabaseServerClient()).list(
      input.accountId,
    ),
  { auth: true, schema: ListWorkspaceRetainersSchema },
);

export const linkWorkspaceRetainerToProjectAction = enhanceAction(
  async (input) => {
    const result = await createWorkspaceRetainersService(
      getSupabaseServerClient(),
    ).linkToProject(input);

    revalidatePath('/home/[account]/retainers', 'page');
    revalidatePath('/home/[account]/projects', 'layout');
    revalidatePath('/home/[account]/clients', 'layout');
    revalidatePath('/home/[account]/finances', 'layout');

    return result;
  },
  { auth: true, schema: LinkWorkspaceRetainerToProjectSchema },
);
