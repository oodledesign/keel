import {
  AUTO_MATCH_CONFIDENCE,
  WEAK_MATCH_CONFIDENCE,
  type RetainerMatchKind,
} from './constants';
import type { LadderPools, LadderService } from './types';

/**
 * Step 1 = allowlisted services, or previously burned/linked services when
 * the allowlist is empty. Step 2 = remaining active catalogue.
 */
export function splitServicePools(input: {
  catalogue: LadderService[];
  allowlistIds: string[];
  previouslyUsedIds: string[];
}): LadderPools {
  const active = input.catalogue.filter((service) => service.creditCost >= 1);
  const byId = new Map(active.map((service) => [service.id, service]));

  const projectIds = new Set(
    input.allowlistIds.length > 0
      ? input.allowlistIds.filter((id) => byId.has(id))
      : input.previouslyUsedIds.filter((id) => byId.has(id)),
  );

  const projectServices = active.filter((service) => projectIds.has(service.id));
  const workspaceOnlyServices = active.filter(
    (service) => !projectIds.has(service.id),
  );

  return { projectServices, workspaceOnlyServices };
}

export function resolveMatchKind(input: {
  serviceId: string | null;
  confidence: number | null;
  proposedName?: string | null;
  projectServiceIds: ReadonlySet<string>;
  workspaceServiceIds: ReadonlySet<string>;
}): RetainerMatchKind {
  const confidence = input.confidence ?? 0;
  const strongEnough = confidence >= WEAK_MATCH_CONFIDENCE;

  if (input.serviceId && strongEnough) {
    if (input.projectServiceIds.has(input.serviceId)) {
      return 'project_service';
    }
    if (input.workspaceServiceIds.has(input.serviceId)) {
      return 'workspace_service';
    }
  }

  const proposed = input.proposedName?.trim();
  if (proposed) {
    return 'propose_new';
  }

  return 'uncategorised';
}

export function canAutoApply(input: {
  autoMatchEnabled: boolean;
  matchKind: RetainerMatchKind;
  confidence: number | null;
  creditCost: number;
  balance: number;
}): boolean {
  if (!input.autoMatchEnabled) return false;
  if (input.matchKind !== 'project_service') return false;
  if ((input.confidence ?? 0) < AUTO_MATCH_CONFIDENCE) return false;
  if (input.creditCost < 1) return false;
  return input.balance >= input.creditCost;
}

export function suggestedCreditCost(input: {
  matchKind: RetainerMatchKind;
  serviceCost?: number | null;
  proposedCost?: number | null;
}): number | null {
  if (input.matchKind === 'uncategorised') return null;
  if (input.matchKind === 'propose_new') {
    const proposed = input.proposedCost;
    if (typeof proposed === 'number' && proposed >= 1) {
      return Math.round(proposed);
    }
    return 1;
  }
  const cost = input.serviceCost;
  if (typeof cost === 'number' && cost >= 1) {
    return Math.round(cost);
  }
  return 1;
}
