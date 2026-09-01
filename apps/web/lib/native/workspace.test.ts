import { describe, expect, it, vi } from 'vitest';

import { loadPersonalNativeWorkspace } from './workspace';
import {
  type NativeWorkspace,
  findNativeWorkspace,
  nativeWorkspaceQueryValue,
  publicHttpsImageUrl,
  publicNativeWorkspace,
  publicNativeWorkspaces,
  toNativeWorkspaceProfile,
  toPersonalNativeWorkspace,
} from './workspace-shared';

const personal: NativeWorkspace = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'dan',
  name: 'Dan',
  profile: 'personal',
  isPersonal: true,
  image: 'https://cdn.example.com/dan.jpg',
};

const studio: NativeWorkspace = {
  id: '22222222-2222-4222-8222-222222222222',
  slug: 'studio',
  name: 'Studio',
  profile: 'work_design',
  isPersonal: false,
  image: 'https://cdn.example.com/oodle.png',
};

const family: NativeWorkspace = {
  id: '33333333-3333-4333-8333-333333333333',
  slug: 'the-house',
  name: 'The House',
  profile: 'family',
  isPersonal: false,
  image: null,
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
      image: null,
    };

    expect(findNativeWorkspace([personal], 'family')).toBeNull();
    expect(findNativeWorkspace([personal], 'business')).toBeNull();
    expect(findNativeWorkspace([family, studio], 'personal')).toBeNull();
    expect(findNativeWorkspace([personal, community], 'business')).toBeNull();
  });

  it('keeps https image URLs and drops anything else', () => {
    expect(publicHttpsImageUrl('https://cdn.example.com/oodle.png')).toBe(
      'https://cdn.example.com/oodle.png',
    );
    expect(
      publicHttpsImageUrl(' http://cdn.example.com/oodle.png '),
    ).toBeNull();
    expect(
      publicHttpsImageUrl('/storage/v1/object/public/logos/o.png'),
    ).toBeNull();
    expect(publicHttpsImageUrl('')).toBeNull();
    expect(publicHttpsImageUrl(null)).toBeNull();
  });

  it('publishes image on the native workspace payload', () => {
    expect(publicNativeWorkspace(studio)).toEqual({
      id: studio.id,
      slug: studio.slug,
      name: studio.name,
      profile: studio.profile,
      isPersonal: false,
      image: 'https://cdn.example.com/oodle.png',
    });
    expect(
      publicNativeWorkspace({ ...studio, image: 'http://insecure' }).image,
    ).toBeNull();
    expect(publicNativeWorkspace(family).image).toBeNull();
  });

  it('serializes Personal when the slug is empty and keeps it in the public list', () => {
    const unnamed = toPersonalNativeWorkspace({
      id: personal.id,
      name: 'Dan Potter',
      slug: '   ',
      image: null,
    });

    expect(unnamed).toMatchObject({
      id: personal.id,
      slug: '',
      name: 'Dan Potter',
      profile: 'personal',
      isPersonal: true,
    });
    expect(nativeWorkspaceQueryValue(unnamed)).toBe(personal.id);
    expect(
      findNativeWorkspace([unnamed, studio], personal.id)?.isPersonal,
    ).toBe(true);
    expect(findNativeWorkspace([unnamed, studio], 'personal')?.id).toBe(
      personal.id,
    );

    const published = publicNativeWorkspaces([unnamed, studio]);
    expect(published).toHaveLength(2);
    expect(published[0]).toEqual({
      id: personal.id,
      slug: '',
      name: 'Dan Potter',
      profile: 'personal',
      isPersonal: true,
      image: null,
    });
    expect(published.some((workspace) => workspace.isPersonal)).toBe(true);
  });
});

describe('loadPersonalNativeWorkspace', () => {
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  function accountsMaybeSingle(result: {
    data: {
      id: string;
      name: string | null;
      slug: string | null;
      picture_url: string | null;
    } | null;
    error: { message: string } | null;
  }) {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue(result),
    };
  }

  it('keeps Personal when the slug is empty', async () => {
    const accounts = accountsMaybeSingle({
      data: {
        id: userId,
        name: 'Dan Potter',
        slug: '',
        picture_url: null,
      },
      error: null,
    });
    const brand = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const from = vi.fn((table: string) =>
      table === 'account_brand_settings' ? brand : accounts,
    );

    const workspace = await loadPersonalNativeWorkspace(
      { from } as never,
      userId,
      { adminClient: null },
    );

    expect(workspace).toMatchObject({
      id: userId,
      slug: '',
      name: 'Dan Potter',
      isPersonal: true,
      profile: 'personal',
    });
    expect(nativeWorkspaceQueryValue(workspace!)).toBe(userId);
  });

  it('falls back to the personal membership row when the owner query is empty', async () => {
    const accounts = accountsMaybeSingle({ data: null, error: null });
    const memberships = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [
          {
            account: {
              id: userId,
              name: 'Dan',
              slug: null,
              picture_url: null,
              is_personal_account: true,
            },
          },
        ],
        error: null,
      }),
    };
    const brand = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const from = vi.fn((table: string) => {
      if (table === 'accounts_memberships') return memberships;
      if (table === 'account_brand_settings') return brand;
      return accounts;
    });

    const workspace = await loadPersonalNativeWorkspace(
      { from } as never,
      userId,
      { adminClient: null },
    );

    expect(from).toHaveBeenCalledWith('accounts_memberships');
    expect(workspace?.id).toBe(userId);
    expect(workspace?.isPersonal).toBe(true);
    expect(workspace?.slug).toBe('');
  });

  it('uses the admin client when the user-scoped lookups miss', async () => {
    const emptyAccounts = accountsMaybeSingle({ data: null, error: null });
    const emptyMemberships = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const userFrom = vi.fn((table: string) =>
      table === 'accounts_memberships' ? emptyMemberships : emptyAccounts,
    );

    const adminAccounts = accountsMaybeSingle({
      data: {
        id: userId,
        name: 'Dan Potter',
        slug: null,
        picture_url: null,
      },
      error: null,
    });
    const adminBrand = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const adminFrom = vi.fn((table: string) =>
      table === 'account_brand_settings' ? adminBrand : adminAccounts,
    );

    const workspace = await loadPersonalNativeWorkspace(
      { from: userFrom } as never,
      userId,
      { adminClient: { from: adminFrom } as never },
    );

    expect(userFrom).toHaveBeenCalled();
    expect(adminFrom).toHaveBeenCalledWith('accounts');
    expect(workspace?.id).toBe(userId);
    expect(workspace?.isPersonal).toBe(true);
  });
});
