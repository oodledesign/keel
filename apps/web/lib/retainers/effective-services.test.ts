import { describe, expect, it } from 'vitest';

import {
  type CatalogueService,
  type ScopedServiceOverride,
  UNCATEGORIZED_SORT,
  activeEffectiveServices,
  buildMatchPools,
  clientFacingEffectiveServices,
  clientInheritanceLabel,
  groupServicesByCategory,
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
    isVisible: extras.isVisible ?? true,
    sortOrder: extras.sortOrder ?? 0,
    scope: extras.scope ?? 'workspace',
    sourceServiceId: extras.sourceServiceId ?? null,
    clientId: extras.clientId ?? null,
    projectId: extras.projectId ?? null,
    categoryId: extras.categoryId ?? null,
    categoryName: extras.categoryName ?? null,
    categorySortOrder: extras.categorySortOrder ?? UNCATEGORIZED_SORT,
  };
}

const webflow = workspace('svc-webflow', 'Website update', 2, {
  sortOrder: 1,
  categoryId: 'cat-web',
  categoryName: 'Web',
  categorySortOrder: 0,
});
const community = workspace('svc-community', 'Community app update', 4, {
  sortOrder: 2,
});
const seo = workspace('svc-seo', 'SEO article', 3, { sortOrder: 3 });
const customClient = workspace('svc-client-custom', 'Member onboarding', 5, {
  scope: 'client',
  clientId: 'client-a',
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
      clientId: 'client-a',
    });

    expect(list.source).toBe('client');
    expect(list.inheritedFrom).toBe('client');
    expect(list.services).toHaveLength(2);
    expect(list.services.find((row) => row.id === webflow.id)).toMatchObject({
      name: 'Webflow tweak',
      creditCost: 3,
      isVisible: true,
    });
    expect(list.services.map((row) => row.id)).toEqual([
      webflow.id,
      customClient.id,
    ]);
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

  it('inherits workspace visibility unless a customized layer overrides it', () => {
    const hiddenWebflow = workspace('svc-webflow', 'Website update', 2, {
      isVisible: false,
      categoryId: 'cat-web',
      categoryName: 'Web',
      categorySortOrder: 0,
    });
    const inherited = resolveEffectiveServices({
      workspace: [hiddenWebflow, community],
      clientCustomized: false,
      clientOverrides: [],
      projectCustomized: false,
      projectOverrides: [],
    });
    expect(
      inherited.services.find((row) => row.id === hiddenWebflow.id),
    ).toMatchObject({
      isVisible: false,
    });

    const clientHidden = resolveEffectiveServices({
      workspace: [webflow, community],
      clientCustomized: true,
      clientOverrides: [{ serviceId: webflow.id, isVisible: false }],
      projectCustomized: false,
      projectOverrides: [],
      clientId: 'client-a',
    });
    expect(clientHidden.services[0]).toMatchObject({
      id: webflow.id,
      isVisible: false,
    });
  });

  it('does not resolve another client’s custom service onto this list', () => {
    const otherClient = workspace('svc-other', 'Other client only', 2, {
      scope: 'client',
      clientId: 'client-b',
    });
    const list = resolveEffectiveServices({
      workspace: [webflow, otherClient],
      clientCustomized: true,
      clientOverrides: [{ serviceId: otherClient.id }],
      projectCustomized: false,
      projectOverrides: [],
      clientId: 'client-a',
    });

    expect(list.services).toEqual([]);
  });

  it('does not resolve client extras when clientId is missing', () => {
    const list = resolveEffectiveServices({
      workspace: [customClient],
      clientCustomized: true,
      clientOverrides: [{ serviceId: customClient.id }],
      projectCustomized: false,
      projectOverrides: [],
      clientId: null,
    });

    expect(list.source).toBe('client');
    expect(list.services).toEqual([]);
  });

  it('does not resolve project extras when projectId is missing', () => {
    const projectOnly = workspace('svc-project', 'Project only', 2, {
      scope: 'project',
      projectId: 'project-a',
    });
    const list = resolveEffectiveServices({
      workspace: [projectOnly],
      clientCustomized: false,
      clientOverrides: [],
      projectCustomized: true,
      projectOverrides: [{ serviceId: projectOnly.id }],
      projectId: null,
    });

    expect(list.source).toBe('project');
    expect(list.services).toEqual([]);
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

describe('clientFacingEffectiveServices', () => {
  it('excludes hidden services from portal and match pools', () => {
    const list = resolveEffectiveServices({
      workspace: [webflow, community],
      clientCustomized: true,
      clientOverrides: [
        { serviceId: webflow.id, isVisible: false },
        { serviceId: community.id, isVisible: true },
      ],
      projectCustomized: false,
      projectOverrides: [],
      clientId: 'client-a',
    });

    expect(activeEffectiveServices(list).map((row) => row.id)).toEqual([
      webflow.id,
      community.id,
    ]);
    expect(clientFacingEffectiveServices(list).map((row) => row.id)).toEqual([
      community.id,
    ]);
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

  it('does not auto-match a hidden effective service', () => {
    const effective = resolveEffectiveServices({
      workspace: [webflow, community],
      clientCustomized: true,
      clientOverrides: [
        { serviceId: webflow.id, isVisible: false },
        { serviceId: community.id },
      ],
      projectCustomized: false,
      projectOverrides: [],
      clientId: 'client-a',
    });

    const pools = buildMatchPools({
      workspaceCatalogue: [community].map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        creditCost: row.creditCost,
      })),
      effective,
      previouslyUsedIds: [webflow.id],
    });

    expect(pools.projectServices.map((row) => row.id)).toEqual([community.id]);
    expect(pools.projectServices.some((row) => row.id === webflow.id)).toBe(
      false,
    );
  });
});

describe('groupServicesByCategory', () => {
  it('groups by category order and puts Uncategorized last', () => {
    const groups = groupServicesByCategory(
      [community, webflow, seo],
      [
        { id: 'cat-web', name: 'Web', sortOrder: 0 },
        { id: 'cat-support', name: 'Support', sortOrder: 1 },
      ],
    );

    expect(groups.map((group) => group.name)).toEqual(['Web', 'Uncategorized']);
    expect(groups[0]?.services.map((row) => row.id)).toEqual([webflow.id]);
    expect(groups[1]?.services.map((row) => row.name)).toEqual([
      'Community app update',
      'SEO article',
    ]);
  });
});
