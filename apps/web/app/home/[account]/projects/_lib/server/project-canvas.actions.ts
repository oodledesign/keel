'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { queueBrainIndexSource } from '~/lib/brain/sync';

import {
  DeleteProjectCanvasItemsSchema,
  LoadProjectCanvasNoteSchema,
  LoadProjectCanvasSchema,
  UpdateProjectCanvasNoteSchema,
  UpsertProjectCanvasItemsSchema,
} from '../schema/project-canvas.schema';
import { createProjectCanvasService } from './project-canvas.service';

function getService() {
  return createProjectCanvasService(getSupabaseServerClient());
}

export const loadProjectCanvas = enhanceAction(
  async (input) => getService().load(input),
  { schema: LoadProjectCanvasSchema },
);

export const upsertProjectCanvasItems = enhanceAction(
  async (input) => getService().upsert(input),
  { schema: UpsertProjectCanvasItemsSchema },
);

export const deleteProjectCanvasItems = enhanceAction(
  async (input) => getService().delete(input),
  { schema: DeleteProjectCanvasItemsSchema },
);

export const loadProjectCanvasNote = enhanceAction(
  async (input) => getService().loadNote(input),
  { schema: LoadProjectCanvasNoteSchema },
);

export const updateProjectCanvasNote = enhanceAction(
  async (input) => {
    const note = await getService().updateNote(input);
    queueBrainIndexSource(input.accountId, 'note', note.id);
    return note;
  },
  { schema: UpdateProjectCanvasNoteSchema },
);
