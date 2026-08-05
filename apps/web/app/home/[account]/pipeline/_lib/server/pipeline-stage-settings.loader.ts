import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { DEFAULT_COMMERCIAL_WIP_BOARD_NAME } from '~/lib/commercial/commercial-constants';
import {
  type PipelineStageConfigItem,
  resolveCommercialPipelineStageConfig,
} from '~/lib/commercial/pipeline-stage-config';

export type PipelineBoardSettings = {
  stages: PipelineStageConfigItem[];
  boardName: string;
};

export async function loadPipelineBoardStageSettings(
  accountId: string,
): Promise<PipelineStageConfigItem[]> {
  const settings = await loadPipelineBoardSettings(accountId);
  return settings.stages;
}

export async function loadPipelineBoardSettings(
  accountId: string,
): Promise<PipelineBoardSettings> {
  const client = getSupabaseServerClient();
  // board_name may lag generated Database types until typegen
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('pipeline_board_stage_settings')
    .select('stages, board_name')
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) {
    console.error('[pipeline] failed to load stage settings', error.message);
    return {
      stages: resolveCommercialPipelineStageConfig(null),
      boardName: DEFAULT_COMMERCIAL_WIP_BOARD_NAME,
    };
  }

  const row = data as { stages?: unknown; board_name?: string | null } | null;
  const boardName =
    row?.board_name?.trim() || DEFAULT_COMMERCIAL_WIP_BOARD_NAME;

  return {
    stages: resolveCommercialPipelineStageConfig(row?.stages),
    boardName,
  };
}

/** Lightweight nav label loader — falls back to WIP. */
export async function loadCommercialPipelineBoardName(
  accountId: string,
): Promise<string> {
  const client = getSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('pipeline_board_stage_settings')
    .select('board_name')
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) {
    console.error('[pipeline] failed to load board name', error.message);
    return DEFAULT_COMMERCIAL_WIP_BOARD_NAME;
  }

  const name = (data as { board_name?: string | null } | null)?.board_name;
  return name?.trim() || DEFAULT_COMMERCIAL_WIP_BOARD_NAME;
}
