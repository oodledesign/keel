'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import {
  COMMERCIAL_PIPELINE_STAGES,
  DEFAULT_COMMERCIAL_WIP_BOARD_NAME,
  type CommercialPipelineStage,
} from '~/lib/commercial/commercial-constants';
import {
  type PipelineStageConfigItem,
  resolveCommercialPipelineStageConfig,
} from '~/lib/commercial/pipeline-stage-config';

const StageItemSchema = z.object({
  key: z.enum(COMMERCIAL_PIPELINE_STAGES),
  label: z.string().trim().min(1).max(80),
  hidden: z.boolean(),
});

const SaveSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).max(200),
  stages: z.array(StageItemSchema).min(1),
  boardName: z.string().trim().min(1).max(40).optional(),
});

export const savePipelineBoardStageSettings = enhanceAction(
  async (input, user) => {
    const client = getSupabaseServerClient();

    const seen = new Set<string>();
    const stages: PipelineStageConfigItem[] = [];

    for (const stage of input.stages) {
      if (seen.has(stage.key)) continue;
      seen.add(stage.key);
      stages.push({
        key: stage.key as CommercialPipelineStage,
        label: stage.label.trim(),
        hidden: stage.hidden,
      });
    }

    // Ensure every canonical stage is present.
    const merged = resolveCommercialPipelineStageConfig(stages);

    const visibleCount = merged.filter((stage) => !stage.hidden).length;
    if (visibleCount === 0) {
      throw new Error('At least one phase must remain visible');
    }

    const boardName =
      input.boardName?.trim() || DEFAULT_COMMERCIAL_WIP_BOARD_NAME;

    // board_name may lag generated Database types until typegen
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (client as any)
      .from('pipeline_board_stage_settings')
      .upsert(
        {
          account_id: input.accountId,
          stages: merged,
          board_name: boardName,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        },
        { onConflict: 'account_id' },
      );

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(
      pathsConfig.app.accountPipeline.replace('[account]', input.accountSlug),
      'page',
    );
    revalidatePath(
      pathsConfig.app.accountHome.replace('[account]', input.accountSlug),
      'layout',
    );

    return { stages: merged, boardName };
  },
  { schema: SaveSchema },
);
