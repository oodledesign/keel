'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  DeleteContentPostSchema,
  LoadProjectContentSchema,
  SaveContentPostSchema,
  SavePeriodNoteSchema,
} from '../schema/project-content.schema';
import { createProjectContentService } from './project-content.service';

function getService() {
  return createProjectContentService(getSupabaseServerClient());
}

export const loadProjectContent = enhanceAction(
  async (input) => getService().load(input),
  { schema: LoadProjectContentSchema },
);

export const saveContentPost = enhanceAction(
  async (input) => getService().savePost(input),
  { schema: SaveContentPostSchema },
);

export const deleteContentPost = enhanceAction(
  async (input) => getService().deletePost(input),
  { schema: DeleteContentPostSchema },
);

export const savePeriodNote = enhanceAction(
  async (input) => getService().saveNote(input),
  { schema: SavePeriodNoteSchema },
);
