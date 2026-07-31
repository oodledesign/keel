import {
  COMMERCIAL_PIPELINE_BOARD_STAGES,
  COMMERCIAL_PIPELINE_LEGACY_STAGE_MAP,
  COMMERCIAL_PIPELINE_LOST_STAGE,
  COMMERCIAL_PIPELINE_STAGES,
  COMMERCIAL_PIPELINE_STAGE_LABELS,
  COMMERCIAL_PIPELINE_WON_STAGE,
  type CommercialPipelineStage,
} from './commercial-constants';

export type PipelineStageConfigItem = {
  key: CommercialPipelineStage;
  label: string;
  hidden: boolean;
};

export type PipelineStageBoardItem = {
  key: string;
  label: string;
  hidden: boolean;
  /** True when deals still sit on this stage even if the column is hidden. */
  forceVisible?: boolean;
};

const CANONICAL_KEYS = new Set<string>(COMMERCIAL_PIPELINE_STAGES);

export function isCommercialPipelineStage(
  value: string,
): value is CommercialPipelineStage {
  return CANONICAL_KEYS.has(value);
}

export function normalizeCommercialPipelineStage(
  stage: string,
): CommercialPipelineStage | string {
  if (isCommercialPipelineStage(stage)) return stage;
  return COMMERCIAL_PIPELINE_LEGACY_STAGE_MAP[stage] ?? stage;
}

export function defaultCommercialPipelineStageConfig(): PipelineStageConfigItem[] {
  return COMMERCIAL_PIPELINE_BOARD_STAGES.map((stage) => ({
    key: stage.key,
    label: stage.label,
    hidden: stage.hidden,
  }));
}

function sanitizeStoredStages(raw: unknown): PipelineStageConfigItem[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const byKey = new Map<string, { label?: string; hidden?: boolean }>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const key = typeof record.key === 'string' ? record.key : '';
    if (!isCommercialPipelineStage(key)) continue;
    byKey.set(key, {
      label: typeof record.label === 'string' ? record.label.trim() : undefined,
      hidden: typeof record.hidden === 'boolean' ? record.hidden : undefined,
    });
  }

  if (byKey.size === 0) return null;

  const defaults = defaultCommercialPipelineStageConfig();
  const orderedKeys: CommercialPipelineStage[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const key = (item as { key?: unknown }).key;
    if (
      typeof key === 'string' &&
      isCommercialPipelineStage(key) &&
      !orderedKeys.includes(key)
    ) {
      orderedKeys.push(key);
    }
  }

  for (const stage of defaults) {
    if (!orderedKeys.includes(stage.key)) {
      orderedKeys.push(stage.key);
    }
  }

  return orderedKeys.map((key) => {
    const stored = byKey.get(key);
    const fallback = defaults.find((stage) => stage.key === key)!;
    return {
      key,
      label:
        stored?.label && stored.label.length > 0
          ? stored.label
          : (COMMERCIAL_PIPELINE_STAGE_LABELS[key] ?? fallback.label),
      hidden: stored?.hidden ?? fallback.hidden,
    };
  });
}

export function resolveCommercialPipelineStageConfig(
  stored: unknown,
): PipelineStageConfigItem[] {
  return sanitizeStoredStages(stored) ?? defaultCommercialPipelineStageConfig();
}

/**
 * Board columns: configured order, skipping hidden stages unless deals remain.
 */
export function resolveCommercialPipelineBoardStages(input: {
  stored?: unknown;
  dealStages?: Iterable<string>;
}): PipelineStageBoardItem[] {
  const config = resolveCommercialPipelineStageConfig(input.stored);
  const occupied = new Set<string>();

  for (const stage of input.dealStages ?? []) {
    occupied.add(normalizeCommercialPipelineStage(stage));
  }

  const board: PipelineStageBoardItem[] = [];

  for (const stage of config) {
    if (!stage.hidden || occupied.has(stage.key)) {
      board.push({
        ...stage,
        forceVisible: stage.hidden && occupied.has(stage.key),
      });
    }
  }

  // Orphan legacy/custom keys that still have deals.
  for (const stage of occupied) {
    if (board.some((item) => item.key === stage)) continue;
    const label =
      (isCommercialPipelineStage(stage)
        ? COMMERCIAL_PIPELINE_STAGE_LABELS[stage]
        : undefined) ?? stage;
    board.push({
      key: stage,
      label,
      hidden: false,
      forceVisible: true,
    });
  }

  return board;
}

export function commercialPipelineStageLabel(
  key: string,
  config?: PipelineStageConfigItem[],
): string {
  const normalized = normalizeCommercialPipelineStage(key);
  const fromConfig = config?.find((stage) => stage.key === normalized)?.label;
  if (fromConfig) return fromConfig;
  if (isCommercialPipelineStage(normalized)) {
    return COMMERCIAL_PIPELINE_STAGE_LABELS[normalized];
  }
  return key;
}

export function isCommercialWonStage(stage: string): boolean {
  return (
    normalizeCommercialPipelineStage(stage) === COMMERCIAL_PIPELINE_WON_STAGE
  );
}

export function isCommercialLostStage(stage: string): boolean {
  return (
    normalizeCommercialPipelineStage(stage) === COMMERCIAL_PIPELINE_LOST_STAGE
  );
}

export function isCommercialTerminalStage(stage: string): boolean {
  return isCommercialWonStage(stage) || isCommercialLostStage(stage);
}
