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
});
