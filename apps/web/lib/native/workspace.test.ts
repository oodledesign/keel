import { describe, expect, it } from 'vitest';

import {
  type NativeWorkspace,
  findNativeWorkspace,
  toNativeWorkspaceProfile,
} from './workspace-shared';

const personal: NativeWorkspace = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'dan',
  name: 'Dan',
  profile: 'personal',
  isPersonal: true,
};

const studio: NativeWorkspace = {
  id: '22222222-2222-4222-8222-222222222222',
  slug: 'studio',
  name: 'Studio',
  profile: 'work_design',
  isPersonal: false,
};

const family: NativeWorkspace = {
  id: '33333333-3333-4333-8333-333333333333',
  slug: 'the-house',
  name: 'The House',
  profile: 'family',
  isPersonal: false,
};

describe('native workspaces', () => {
  it('maps workspace profiles to the native union', () => {
    expect(toNativeWorkspaceProfile('personal')).toBe('personal');
    expect(toNativeWorkspaceProfile('family')).toBe('family');
    expect(toNativeWorkspaceProfile('community')).toBe('community');
    expect(toNativeWorkspaceProfile('commercial_property')).toBe(
      'commercial_property',
    );
    expect(toNativeWorkspaceProfile('building_surveyor')).toBe(
      'building_surveyor',
    );
    expect(toNativeWorkspaceProfile('work_design')).toBe('work_design');
    expect(toNativeWorkspaceProfile('work_property')).toBe('work_design');
  });

  it('resolves a membership by slug or id', () => {
    const workspaces = [personal, studio];

    expect(findNativeWorkspace(workspaces, 'studio')?.id).toBe(studio.id);
    expect(findNativeWorkspace(workspaces, studio.id)?.slug).toBe('studio');
    expect(findNativeWorkspace(workspaces, 'dan')?.isPersonal).toBe(true);
    expect(findNativeWorkspace(workspaces, 'missing')).toBeNull();
  });

  it('resolves personal, family, and business aliases after exact slug or id', () => {
    const workspaces = [personal, family, studio];

    expect(findNativeWorkspace(workspaces, 'personal')?.id).toBe(personal.id);
    expect(findNativeWorkspace(workspaces, 'family')?.id).toBe(family.id);
    expect(findNativeWorkspace(workspaces, 'business')?.id).toBe(studio.id);
    expect(findNativeWorkspace(workspaces, 'BUSINESS')?.id).toBe(studio.id);
  });

  it('prefers an exact slug that collides with an alias word', () => {
    const aliased: NativeWorkspace = {
      ...studio,
      slug: 'business',
    };

    expect(findNativeWorkspace([personal, aliased], 'business')?.id).toBe(
      aliased.id,
    );
  });

  it('returns null when an alias has no matching workspace', () => {
    const community: NativeWorkspace = {
      id: '44444444-4444-4444-8444-444444444444',
      slug: 'village',
      name: 'Village',
      profile: 'community',
      isPersonal: false,
    };

    expect(findNativeWorkspace([personal], 'family')).toBeNull();
    expect(findNativeWorkspace([personal], 'business')).toBeNull();
    expect(findNativeWorkspace([family, studio], 'personal')).toBeNull();
    expect(findNativeWorkspace([personal, community], 'business')).toBeNull();
  });
});
