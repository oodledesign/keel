import { describe, expect, it } from 'vitest';

import {
  type CatalogueService,
  type ScopedServiceOverride,
  activeEffectiveServices,
  buildMatchPools,
  clientInheritanceLabel,
  inheritanceLabel,
  resolveEffectiveServices,
} from './effective-services';

function workspace(
  id: string,
  name: string,
  creditCost = 2,
  extras: Partial<CatalogueService> = {},
): CatalogueService {
  return {
    id,
    name,
    description: `${name} work`,
    creditCost,
    requestTypeId: extras.requestTypeId ?? null,
    isActive: extras.isActive ?? true,
    sortOrder: extras.sortOrder ?? 0,
    scope: extras.scope ?? 'workspace',
    sourceServiceId: extras.sourceServiceId ?? null,
  };
}

const webflow = workspace('svc-webflow', 'Website update', 2, { sortOrder: 1 });
const community = workspace('svc-community', 'Community app update', 4, {
  sortOrder: 2,
});
const seo = workspace('svc-seo', 'SEO article', 3, { sortOrder: 3 });
const customClient = workspace('svc-client-custom', 'Member onboarding', 5, {
  scope: 'client',
  sortOrder: 4,
});

describe('resolveEffectiveServices', () => {
  it('uses the workspace library when nothing is customized', () => {
    const list = resolveEffectiveServices({
      workspace: [webflow, community, seo, customClient],
      clientCustomized: false,
      clientOverrides: [],
      projectCustomized: false,
      projectOverrides: [],
    });

    expect(list.source).toBe('workspace');
    expect(list.inheritedFrom).toBe('workspace');
    expect(list.customized).toBe(false);
    expect(list.services.map((row) => row.id)).toEqual([
      webflow.id,
      community.id,
      seo.id,
    ]);
    expect(inheritanceLabel(list)).toBe('Using workspace library');
  });

  it('uses the client seed, including rename/reprice/trim and custom rows', () => {
    const clientOverrides: ScopedServiceOverride[] = [
      {
        serviceId: webflow.id,
        name: 'Webflow tweak',
        creditCost: 3,
        sortOrder: 0,
      },
      { serviceId: customClient.id, sortOrder: 1 },
    ];

    const list = resolveEffectiveServices({
      workspace: [webflow, community, seo, customClient],
      clientCustomized: true,
      clientOverrides,
      projectCustomized: false,
      projectOverrides: [],
    });

    expect(list.source).toBe('client');
    expect(list.inheritedFrom).toBe('client');
    expect(list.services).toHaveLength(2);
    expect(list.services[0]).toMatchObject({
      id: webflow.id,
      name: 'Webflow tweak',
      creditCost: 3,
    });
    expect(list.services[1]?.id).toBe(customClient.id);
    expect(inheritanceLabel(list)).toBe('Using client defaults');
    expect(clientInheritanceLabel(true)).toBe('Customized for this client');
  });

  it('lets a project override win over the client seed', () => {
    const list = resolveEffectiveServices({
      workspace: [webflow, community, seo],
      clientCustomized: true,
      clientOverrides: [{ serviceId: webflow.id }, { serviceId: community.id }],
      projectCustomized: true,
      projectOverrides: [
        {
          serviceId: seo.id,
          name: 'Project SEO only',
          creditCost: 6,
          isActive: true,
        },
      ],
    });

    expect(list.source).toBe('project');
    expect(list.inheritedFrom).toBeNull();
    expect(list.customized).toBe(true);
    expect(list.services).toEqual([
      expect.objectContaining({
        id: seo.id,
        name: 'Project SEO only',
        creditCost: 6,
      }),
    ]);
    expect(inheritanceLabel(list)).toBe('Customized for this project');
  });

  it('keeps an intentionally empty custom list empty', () => {
    const list = resolveEffectiveServices({
      workspace: [webflow],
      clientCustomized: false,
      clientOverrides: [],
      projectCustomized: true,
      projectOverrides: [],
    });

    expect(list.source).toBe('project');
    expect(list.services).toEqual([]);
    expect(activeEffectiveServices(list)).toEqual([]);
  });
});

describe('buildMatchPools', () => {
  it('keeps the previously-used fallback when the project inherits the workspace library', () => {
    const effective = resolveEffectiveServices({
      workspace: [webflow, community, seo],
      clientCustomized: false,
      clientOverrides: [],
      projectCustomized: false,
      projectOverrides: [],
    });

    const pools = buildMatchPools({
      workspaceCatalogue: [webflow, community, seo].map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        creditCost: row.creditCost,
      })),
      effective,
      previouslyUsedIds: [community.id],
    });

    expect(pools.projectServices.map((row) => row.id)).toEqual([community.id]);
    expect(pools.workspaceOnlyServices.map((row) => row.id)).toEqual([
      webflow.id,
      seo.id,
    ]);
  });

  it('matches the effective client/project list first, then leftover workspace catalogue', () => {
    const effective = resolveEffectiveServices({
      workspace: [webflow, community, seo],
      clientCustomized: true,
      clientOverrides: [
        { serviceId: webflow.id, name: 'Webflow', creditCost: 2 },
      ],
      projectCustomized: false,
      projectOverrides: [],
    });

    const pools = buildMatchPools({
      workspaceCatalogue: [webflow, community, seo].map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        creditCost: row.creditCost,
      })),
      effective,
      previouslyUsedIds: [seo.id],
    });

    expect(pools.projectServices.map((row) => row.id)).toEqual([webflow.id]);
    expect(pools.projectServices[0]?.name).toBe('Webflow');
    expect(pools.workspaceOnlyServices.map((row) => row.id)).toEqual([
      community.id,
      seo.id,
    ]);
  });
});
