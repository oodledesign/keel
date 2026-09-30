'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { CanvasAiAssistSchema } from '../schema/project-canvas-ai.schema';
import { createProjectCanvasAiService } from './project-canvas-ai.service';

export const assistProjectCanvas = enhanceAction(
  async (input) =>
    createProjectCanvasAiService(getSupabaseServerClient()).assist(input),
  { schema: CanvasAiAssistSchema },
);
