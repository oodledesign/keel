import { normalizeCommercialPipelineStage } from './pipeline-stage-config';

/**
 * Word-boundary "billed" on free text. Kept in lockstep with
 * `20270115120000_commercial_wip_stage_ladder.sql`.
 */
const BILLED_WORD = /(^|[^a-z0-9])billed([^a-z0-9]|$)/i;

export type CommercialInstructionStageSource = {
  stage: string;
  workType?: string | null;
  name?: string | null;
  notes?: string | null;
  hotsNotes?: string | null;
  nextAction?: string | null;
};

/** True when an existing completed/exchanged row should land on Billed. */
export function commercialInstructionHasBilledSignal(
  input: Pick<
    CommercialInstructionStageSource,
    'name' | 'notes' | 'hotsNotes' | 'nextAction'
  >,
): boolean {
  return [input.name, input.notes, input.hotsNotes, input.nextAction].some(
    (value) => typeof value === 'string' && BILLED_WORD.test(value),
  );
}

/**
 * One-time remap of a stored instruction stage onto the ladder.
 * Mirrors the commercial-property UPDATE in the stage-ladder migration.
 * - completed_exchanged → billed when a billed signal is present, else completed
 * - under_offer_negotiating → under_offer
 * - management work sitting in current/potential → managed
 * - other legacy keys follow COMMERCIAL_PIPELINE_LEGACY_STAGE_MAP
 */
export function remapStoredCommercialInstructionStage(
  input: CommercialInstructionStageSource,
): string {
  const stage = input.stage;

  if (stage === 'under_offer_negotiating') return 'under_offer';

  if (stage === 'completed_exchanged') {
    return commercialInstructionHasBilledSignal(input) ? 'billed' : 'completed';
  }

  if (
    input.workType === 'management' &&
    (stage === 'current' || stage === 'potential')
  ) {
    return 'managed';
  }

  return String(normalizeCommercialPipelineStage(stage));
}
