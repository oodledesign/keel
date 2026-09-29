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
 * Stored instruction stages are left for Bracketts to file by hand.
 * Combined keys (`completed_exchanged`, `under_offer_negotiating`) and
 * management work still sitting in current/potential are not rewritten.
 * Older Kato aliases still follow the legacy map.
 * `commercialInstructionHasBilledSignal` is the heuristic we chose not to run.
 */
export function remapStoredCommercialInstructionStage(
  input: CommercialInstructionStageSource,
): string {
  return String(normalizeCommercialPipelineStage(input.stage));
}
