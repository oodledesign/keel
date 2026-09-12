import { describe, expect, it } from 'vitest';

import { AUTO_MATCH_CONFIDENCE, WEAK_MATCH_CONFIDENCE } from './constants';
import {
  canAutoApply,
  resolveMatchKind,
  splitServicePools,
  suggestedCreditCost,
} from './match-ladder';
import type { LadderService } from './types';

const seo: LadderService = {
  id: 'svc-seo',
  name: 'SEO blog',
  description: 'Monthly blog post',
  creditCost: 2,
};
const ads: LadderService = {
  id: 'svc-ads',
  name: 'Paid ads tweak',
  description: 'Campaign change',
  creditCost: 1,
};
const brand: LadderService = {
  id: 'svc-brand',
  name: 'Brand review',
  description: 'Visual identity',
  creditCost: 3,
};

describe('splitServicePools', () => {
  it('uses the allowlist as project services when present', () => {
    const pools = splitServicePools({
      catalogue: [seo, ads, brand],
      allowlistIds: [seo.id],
      previouslyUsedIds: [ads.id],
    });

    expect(pools.projectServices.map((row) => row.id)).toEqual([seo.id]);
    expect(pools.workspaceOnlyServices.map((row) => row.id)).toEqual([
      ads.id,
      brand.id,
    ]);
  });

  it('falls back to previously used services when allowlist is empty', () => {
    const pools = splitServicePools({
      catalogue: [seo, ads, brand],
      allowlistIds: [],
      previouslyUsedIds: [ads.id, 'missing'],
    });

    expect(pools.projectServices.map((row) => row.id)).toEqual([ads.id]);
    expect(pools.workspaceOnlyServices.map((row) => row.id)).toEqual([
      seo.id,
      brand.id,
    ]);
  });

  it('treats an empty project pool as workspace-only catalogue', () => {
    const pools = splitServicePools({
      catalogue: [seo],
      allowlistIds: [],
      previouslyUsedIds: [],
    });

    expect(pools.projectServices).toEqual([]);
    expect(pools.workspaceOnlyServices.map((row) => row.id)).toEqual([seo.id]);
  });
});

describe('resolveMatchKind', () => {
  const projectServiceIds = new Set([seo.id]);
  const workspaceServiceIds = new Set([ads.id, brand.id]);

  it('keeps a strong project-service match on the first ladder step', () => {
    expect(
      resolveMatchKind({
        serviceId: seo.id,
        confidence: 0.91,
        projectServiceIds,
        workspaceServiceIds,
      }),
    ).toBe('project_service');
  });

  it('climbs to workspace catalogue when the project pick is weak', () => {
    expect(
      resolveMatchKind({
        serviceId: seo.id,
        confidence: WEAK_MATCH_CONFIDENCE - 0.1,
        projectServiceIds,
        workspaceServiceIds,
        proposedName: null,
      }),
    ).toBe('uncategorised');

    expect(
      resolveMatchKind({
        serviceId: ads.id,
        confidence: 0.7,
        projectServiceIds,
        workspaceServiceIds,
      }),
    ).toBe('workspace_service');
  });

  it('proposes a new service when nothing in catalogue fits', () => {
    expect(
      resolveMatchKind({
        serviceId: null,
        confidence: 0.4,
        proposedName: 'Landing page refresh',
        projectServiceIds,
        workspaceServiceIds,
      }),
    ).toBe('propose_new');
  });

  it('ends on uncategorised when there is no usable pick', () => {
    expect(
      resolveMatchKind({
        serviceId: 'unknown',
        confidence: 0.9,
        projectServiceIds,
        workspaceServiceIds,
      }),
    ).toBe('uncategorised');
  });
});

describe('canAutoApply', () => {
  it('requires the switch, a project service, high confidence, and balance', () => {
    expect(
      canAutoApply({
        autoMatchEnabled: true,
        matchKind: 'project_service',
        confidence: AUTO_MATCH_CONFIDENCE,
        creditCost: 2,
        balance: 2,
      }),
    ).toBe(true);

    expect(
      canAutoApply({
        autoMatchEnabled: false,
        matchKind: 'project_service',
        confidence: 0.99,
        creditCost: 1,
        balance: 10,
      }),
    ).toBe(false);

    expect(
      canAutoApply({
        autoMatchEnabled: true,
        matchKind: 'workspace_service',
        confidence: 0.99,
        creditCost: 1,
        balance: 10,
      }),
    ).toBe(false);

    expect(
      canAutoApply({
        autoMatchEnabled: true,
        matchKind: 'project_service',
        confidence: AUTO_MATCH_CONFIDENCE - 0.01,
        creditCost: 1,
        balance: 10,
      }),
    ).toBe(false);

    expect(
      canAutoApply({
        autoMatchEnabled: true,
        matchKind: 'project_service',
        confidence: 0.99,
        creditCost: 3,
        balance: 2,
      }),
    ).toBe(false);
  });
});

describe('suggestedCreditCost', () => {
  it('uses the service cost for catalogue matches and proposed cost for new', () => {
    expect(
      suggestedCreditCost({
        matchKind: 'project_service',
        serviceCost: 4,
      }),
    ).toBe(4);
    expect(
      suggestedCreditCost({
        matchKind: 'propose_new',
        proposedCost: 2.6,
      }),
    ).toBe(3);
    expect(suggestedCreditCost({ matchKind: 'uncategorised' })).toBeNull();
  });
});
