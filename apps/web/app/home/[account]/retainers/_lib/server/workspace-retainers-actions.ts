'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { ListWorkspaceRetainersSchema } from '../schema/workspace-retainers.schema';
import { createWorkspaceRetainersService } from './workspace-retainers.service';

export const listWorkspaceRetainersAction = enhanceAction(
  async (input) =>
    createWorkspaceRetainersService(getSupabaseServerClient()).list(
      input.accountId,
    ),
  { auth: true, schema: ListWorkspaceRetainersSchema },
);
