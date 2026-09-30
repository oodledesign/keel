'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  AddCanvasCommentSchema,
  DeleteCanvasCommentSchema,
  ResolveCanvasCommentSchema,
  UpdateCanvasCommentSchema,
} from '../schema/project-canvas-comments.schema';
import { createProjectCanvasCommentsService } from './project-canvas-comments.service';

function getService() {
  return createProjectCanvasCommentsService(getSupabaseServerClient());
}

export const addCanvasComment = enhanceAction(
  async (input) => getService().add(input),
  { schema: AddCanvasCommentSchema },
);

export const updateCanvasComment = enhanceAction(
  async (input) => getService().update(input),
  { schema: UpdateCanvasCommentSchema },
);

export const resolveCanvasComment = enhanceAction(
  async (input) => getService().resolve(input),
  { schema: ResolveCanvasCommentSchema },
);

export const deleteCanvasComment = enhanceAction(
  async (input) => getService().delete(input),
  { schema: DeleteCanvasCommentSchema },
);
