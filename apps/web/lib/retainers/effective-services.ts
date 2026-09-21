import { splitServicePools } from './match-ladder';
import type { LadderPools, LadderService } from './types';

export type ServiceListSource = 'workspace' | 'client' | 'project';

export type CatalogueService = {
  id: string;
  name: string;
  description: string | null;
  creditCost: number;
  requestTypeId: string | null;
  isActive: boolean;
  sortOrder: number;
  scope: ServiceListSource;
  sourceServiceId: string | null;
  clientId?: string | null;
  projectId?: string | null;
};

export type ScopedServiceOverride = {
  serviceId: string;
  name?: string | null;
  description?: string | null;
  creditCost?: number | null;
  requestTypeId?: string | null;
  isActive?: boolean;
  sortOrder?: number;
};

export type EffectiveService = {
  id: string;
  sourceServiceId: string | null;
  name: string;
  description: string | null;
  creditCost: number;
  requestTypeId: string | null;
  isActive: boolean;
  sortOrder: number;
  scope: ServiceListSource;
};

export type EffectiveServiceList = {
  source: ServiceListSource;
  inheritedFrom: 'workspace' | 'client' | null;
  customized: boolean;
  services: EffectiveService[];
};

function catalogueById(
  rows: CatalogueService[],
): Map<string, CatalogueService> {
  return new Map(rows.map((row) => [row.id, row]));
}

function applyOverride(
  catalogue: CatalogueService,
  override?: ScopedServiceOverride,
): EffectiveService {
  const creditCost = override?.creditCost ?? catalogue.creditCost;
  return {
    id: catalogue.id,
    sourceServiceId: catalogue.sourceServiceId,
    name: override?.name?.trim() || catalogue.name,
    description:
      override?.description === undefined
        ? catalogue.description
        : override.description,
    creditCost:
      typeof creditCost === 'number' && creditCost >= 1
        ? Math.round(creditCost)
        : 1,
    requestTypeId:
      override?.requestTypeId === undefined
        ? catalogue.requestTypeId
        : override.requestTypeId,
    isActive: override?.isActive ?? catalogue.isActive,
    sortOrder: override?.sortOrder ?? catalogue.sortOrder,
    scope: catalogue.scope,
  };
}

function sortServices(rows: EffectiveService[]): EffectiveService[] {
  return [...rows].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      a.name.localeCompare(b.name, 'en-GB', { sensitivity: 'base' }),
  );
}

/**
 * Resolution order: project override if present → else client seed → else
 * workspace library. Custom layers may be empty (intentionally trimmed).
 */
export function resolveEffectiveServices(input: {
  workspace: CatalogueService[];
  clientCustomized: boolean;
  clientOverrides: ScopedServiceOverride[];
  projectCustomized: boolean;
  projectOverrides: ScopedServiceOverride[];
  clientId?: string | null;
  projectId?: string | null;
}): EffectiveServiceList {
  const resolveLayer = (
    overrides: ScopedServiceOverride[],
    extraCatalogue: CatalogueService[] = [],
  ): EffectiveService[] => {
    const lookup = catalogueById([
      ...input.workspace.filter((row) => row.scope === 'workspace'),
      ...extraCatalogue,
    ]);
    return sortServices(
      overrides
        .map((row) => {
          const catalogue = lookup.get(row.serviceId);
          if (!catalogue) return null;
          return applyOverride(catalogue, row);
        })
        .filter((row): row is EffectiveService => row !== null),
    );
  };

  if (input.projectCustomized) {
    const extras = input.workspace.filter(
      (row) =>
        row.scope === 'project' &&
        input.projectId != null &&
        row.projectId === input.projectId,
    );
    return {
      source: 'project',
      inheritedFrom: null,
      customized: true,
      services: resolveLayer(input.projectOverrides, extras),
    };
  }

  if (input.clientCustomized) {
    const extras = input.workspace.filter(
      (row) =>
        row.scope === 'client' &&
        input.clientId != null &&
        row.clientId === input.clientId,
    );
    return {
      source: 'client',
      inheritedFrom: 'client',
      customized: false,
      services: resolveLayer(input.clientOverrides, extras),
    };
  }

  const workspaceOnly = sortServices(
    input.workspace
      .filter((row) => row.scope === 'workspace')
      .map((row) => applyOverride(row)),
  );

  return {
    source: 'workspace',
    inheritedFrom: 'workspace',
    customized: false,
    services: workspaceOnly,
  };
}

export function activeEffectiveServices(
  list: EffectiveServiceList,
): EffectiveService[] {
  return list.services.filter((row) => row.isActive && row.creditCost >= 1);
}

export function toLadderServices(rows: EffectiveService[]): LadderService[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    creditCost: row.creditCost,
  }));
}

/**
 * Matching ladder:
 * - customized / client-seeded lists are step 1 (effective)
 * - remaining workspace catalogue is step 2
 * - inherited workspace default keeps the existing previously-used fallback
 */
export function buildMatchPools(input: {
  workspaceCatalogue: LadderService[];
  effective: EffectiveServiceList;
  previouslyUsedIds: string[];
}): LadderPools {
  const effectiveActive = toLadderServices(
    activeEffectiveServices(input.effective),
  );

  if (input.effective.source === 'workspace') {
    return splitServicePools({
      catalogue: input.workspaceCatalogue,
      allowlistIds: [],
      previouslyUsedIds: input.previouslyUsedIds,
    });
  }

  const effectiveIds = new Set(effectiveActive.map((row) => row.id));
  return {
    projectServices: effectiveActive,
    workspaceOnlyServices: input.workspaceCatalogue.filter(
      (row) => !effectiveIds.has(row.id),
    ),
  };
}

export function inheritanceLabel(list: EffectiveServiceList): string {
  if (list.source === 'project') return 'Customized for this project';
  if (list.source === 'client') return 'Using client defaults';
  return 'Using workspace library';
}

export function clientInheritanceLabel(customized: boolean): string {
  return customized ? 'Customized for this client' : 'Using workspace library';
}
