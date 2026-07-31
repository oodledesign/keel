import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  type PipelineStageConfigItem,
  resolveCommercialPipelineStageConfig,
} from '~/lib/commercial/pipeline-stage-config';

export async function loadPipelineBoardStageSettings(
  accountId: string,
): Promise<PipelineStageConfigItem[]> {
  const client = getSupabaseServerClient();
  const { data, error } = await client
    .from('pipeline_board_stage_settings')
    .select('stages')
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) {
    console.error('[pipeline] failed to load stage settings', error.message);
    return resolveCommercialPipelineStageConfig(null);
  }

  return resolveCommercialPipelineStageConfig(
    (data as { stages?: unknown } | null)?.stages,
  );
}
