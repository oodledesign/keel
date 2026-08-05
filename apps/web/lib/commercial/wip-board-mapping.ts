import {
  COMMERCIAL_PIPELINE_LOST_STAGE,
  COMMERCIAL_PIPELINE_STAGE_LABELS,
  COMMERCIAL_PIPELINE_WON_STAGE,
  type CommercialPipelineStage,
  REQUIREMENT_STATUS_LABELS,
  REQUIREMENT_STATUSES,
  type RequirementStatus,
  normalizeRequirementStage,
} from './commercial-constants';
import { normalizeCommercialPipelineStage } from './pipeline-stage-config';

export type WipBoardKind = 'instruction' | 'requirement';

export type WipBoardView = 'instructions' | 'requirements' | 'both';

/** Shared columns when filter = Both. */
export const WIP_SHARED_STATUSES = [
  'new',
  'active',
  'under_offer_negotiating',
  'closed',
] as const;

export type WipSharedStatus = (typeof WIP_SHARED_STATUSES)[number];

export const WIP_SHARED_STATUS_LABELS: Record<WipSharedStatus, string> = {
  new: 'New',
  active: 'Active',
  under_offer_negotiating: 'Under Offer / Negotiating',
  closed: 'Closed',
};

export type InstructionClosedChoice =
  | typeof COMMERCIAL_PIPELINE_WON_STAGE
  | typeof COMMERCIAL_PIPELINE_LOST_STAGE;

export type RequirementClosedChoice = 'fulfilled' | 'withdrawn';

export function isWipBoardView(value: string | null | undefined): value is WipBoardView {
  return value === 'instructions' || value === 'requirements' || value === 'both';
}

export function parseWipBoardView(
  value: string | null | undefined,
): WipBoardView {
  return isWipBoardView(value) ? value : 'instructions';
}

export function toSharedStatus(
  kind: WipBoardKind,
  stage: string,
): WipSharedStatus {
  if (kind === 'instruction') {
    const normalized = normalizeCommercialPipelineStage(stage);
    if (normalized === 'potential') return 'new';
    if (normalized === 'current') return 'active';
    if (normalized === 'under_offer_negotiating') {
      return 'under_offer_negotiating';
    }
    if (
      normalized === COMMERCIAL_PIPELINE_WON_STAGE ||
      normalized === COMMERCIAL_PIPELINE_LOST_STAGE
    ) {
      return 'closed';
    }
    return 'new';
  }

  const normalized = normalizeRequirementStage(stage);
  if (normalized === 'new') return 'new';
  if (normalized === 'actively_searching') return 'active';
  if (normalized === 'under_offer_negotiating') {
    return 'under_offer_negotiating';
  }
  return 'closed';
}

export function fromSharedStatus(
  kind: 'instruction',
  shared: WipSharedStatus,
  closedChoice?: InstructionClosedChoice,
): CommercialPipelineStage;

export function fromSharedStatus(
  kind: 'requirement',
  shared: WipSharedStatus,
  closedChoice?: RequirementClosedChoice,
): RequirementStatus;

export function fromSharedStatus(
  kind: WipBoardKind,
  shared: WipSharedStatus,
  closedChoice?: InstructionClosedChoice | RequirementClosedChoice,
): CommercialPipelineStage | RequirementStatus {
  if (kind === 'instruction') {
    if (shared === 'new') return 'potential';
    if (shared === 'active') return 'current';
    if (shared === 'under_offer_negotiating') {
      return 'under_offer_negotiating';
    }
    const choice =
      (closedChoice as InstructionClosedChoice | undefined) ??
      COMMERCIAL_PIPELINE_WON_STAGE;
    return choice;
  }

  if (shared === 'new') return 'new';
  if (shared === 'active') return 'actively_searching';
  if (shared === 'under_offer_negotiating') {
    return 'under_offer_negotiating';
  }
  const choice =
    (closedChoice as RequirementClosedChoice | undefined) ?? 'fulfilled';
  return choice;
}

export function instructionBoardStages(
  configKeys?: readonly string[],
): Array<{ key: string; label: string }> {
  // Prefer configured keys when provided; callers pass resolved stage config.
  if (configKeys && configKeys.length > 0) {
    return configKeys.map((key) => ({
      key,
      label:
        COMMERCIAL_PIPELINE_STAGE_LABELS[
          key as CommercialPipelineStage
        ] ?? key,
    }));
  }
  return [
    { key: 'potential', label: 'Potential Instructions' },
    { key: 'current', label: 'Current Instructions' },
    {
      key: 'under_offer_negotiating',
      label: 'Under Offer / Negotiating',
    },
    { key: 'completed_exchanged', label: 'Completed / Exchanged' },
    { key: 'fallen_through', label: 'Fallen through' },
  ];
}

export function requirementBoardStages(): Array<{
  key: RequirementStatus;
  label: string;
}> {
  return REQUIREMENT_STATUSES.map((key) => ({
    key,
    label: REQUIREMENT_STATUS_LABELS[key],
  }));
}

export function sharedBoardStages(): Array<{
  key: WipSharedStatus;
  label: string;
}> {
  return WIP_SHARED_STATUSES.map((key) => ({
    key,
    label: WIP_SHARED_STATUS_LABELS[key],
  }));
}

export function cardCompositeId(kind: WipBoardKind, id: string) {
  return `${kind}:${id}` as const;
}

export function parseCardCompositeId(
  value: string,
): { kind: WipBoardKind; id: string } | null {
  const [kind, ...rest] = value.split(':');
  const id = rest.join(':');
  if (!id) return null;
  if (kind === 'instruction' || kind === 'requirement') {
    return { kind, id };
  }
  return null;
}
