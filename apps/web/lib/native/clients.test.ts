import { describe, expect, it, vi } from 'vitest';

import { listNativeClients } from './clients';
import { mapNativeClient, workspaceShowsNativeClients } from './clients-shared';
import type { NativeWorkspace } from './workspace-shared';

const studio: NativeWorkspace = {
  id: '22222222-2222-4222-8222-222222222222',
  slug: 'oodle',
  name: 'Oodle',
  profile: 'work_design',
  isPersonal: false,
  image: null,
};

const personal: NativeWorkspace = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'dan',
  name: 'Dan',
  profile: 'personal',
  isPersonal: true,
  image: null,
};

const family: NativeWorkspace = {
  id: '33333333-3333-4333-8333-333333333333',
  slug: 'the-house',
  name: 'The House',
  profile: 'family',
  isPersonal: false,
  image: null,
};

describe('workspaceShowsNativeClients', () => {
  it('shows Clients on studio and property profiles only', () => {
    expect(workspaceShowsNativeClients('work_design')).toBe(true);
    expect(workspaceShowsNativeClients('commercial_property')).toBe(true);
    expect(workspaceShowsNativeClients('building_surveyor')).toBe(true);
    expect(workspaceShowsNativeClients('personal')).toBe(false);
    expect(workspaceShowsNativeClients('family')).toBe(false);
    expect(workspaceShowsNativeClients('community')).toBe(false);
  });
});

describe('mapNativeClient', () => {
  it('uses display_name or first + last like the web list', () => {
    expect(
      mapNativeClient({
        id: 'c1',
        display_name: 'Hope and Wonder',
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
        client_type: 'individual',
      }),
    ).toEqual({
      id: 'c1',
      name: 'Hope and Wonder',
      email: 'jane@example.com',
      company_name: null,
      client_type: 'individual',
    });

    expect(
      mapNativeClient({
        id: 'c2',
        display_name: null,
        first_name: 'Sam',
        last_name: 'Reed',
        email: null,
        client_type: 'individual',
      }).name,
    ).toBe('Sam Reed');
  });
});

describe('listNativeClients', () => {
  it('returns an empty list on personal and family without querying', async () => {
    const from = vi.fn();
    const client = { from } as never;

    await expect(listNativeClients(client, personal)).resolves.toEqual([]);
    await expect(listNativeClients(client, family)).resolves.toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it('scopes business clients to the workspace account', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'c1',
            display_name: 'Bracketts Ltd',
            first_name: null,
            last_name: null,
            company_name: 'Bracketts Ltd',
            email: 'hello@bracketts.test',
            client_type: 'business',
          },
        ],
        error: null,
      }),
    };
    const from = vi.fn(() => chain);
    const client = { from } as never;

    const items = await listNativeClients(client, studio);

    expect(from).toHaveBeenCalledWith('clients');
    expect(chain.eq).toHaveBeenCalledWith('account_id', studio.id);
    expect(items).toEqual([
      {
        id: 'c1',
        name: 'Bracketts Ltd',
        email: 'hello@bracketts.test',
        company_name: 'Bracketts Ltd',
        client_type: 'business',
      },
    ]);
  });
});
