import { describe, expect, it, vi } from 'vitest';

import { getNativeClient, listNativeClients } from './clients';
import {
  mapNativeClient,
  mapNativeClientContact,
  workspaceShowsNativeClients,
} from './clients-shared';
import { NativeHttpError } from './http';
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
      image: null,
      logo: null,
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

  it('publishes https logo URLs on image and logo', () => {
    expect(
      mapNativeClient({
        id: 'c3',
        display_name: 'Bracketts',
        picture_url: 'https://cdn.example.com/bracketts.png',
      }),
    ).toMatchObject({
      image: 'https://cdn.example.com/bracketts.png',
      logo: 'https://cdn.example.com/bracketts.png',
    });

    expect(
      mapNativeClient({
        id: 'c4',
        display_name: 'Insecure',
        picture_url: 'http://cdn.example.com/nope.png',
      }).image,
    ).toBeNull();
  });
});

describe('mapNativeClientContact', () => {
  it('composes name, role, email, and primary from the junction row', () => {
    expect(
      mapNativeClientContact({
        id: 'p1',
        first_name: 'Alex',
        last_name: 'Hope',
        email: null,
        phone: '01234 567890',
        role: 'Director',
        is_primary: true,
        emails: [{ email: 'alex@hope.test', is_primary: true }],
      }),
    ).toEqual({
      id: 'p1',
      name: 'Alex Hope',
      role: 'Director',
      email: 'alex@hope.test',
      phone: '01234 567890',
      is_primary: true,
    });
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

  it('scopes business clients to the workspace account and includes logos', async () => {
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
            picture_url: 'https://cdn.example.com/bracketts.png',
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
        image: 'https://cdn.example.com/bracketts.png',
        logo: 'https://cdn.example.com/bracketts.png',
      },
    ]);
  });
});

describe('getNativeClient', () => {
  it('returns 404 on personal without querying', async () => {
    const from = vi.fn();

    await expect(
      getNativeClient({ from } as never, personal, 'c1'),
    ).rejects.toMatchObject({ status: 404 } satisfies Partial<NativeHttpError>);
    expect(from).not.toHaveBeenCalled();
  });

  it('returns the client with workspace-scoped contacts', async () => {
    const clientChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'c1',
          display_name: 'Bracketts Ltd',
          company_name: 'Bracketts Ltd',
          email: 'hello@bracketts.test',
          first_name: null,
          last_name: null,
          client_type: 'business',
          picture_url: 'https://cdn.example.com/bracketts.png',
        },
        error: null,
      }),
    };
    const contactChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    };
    contactChain.order.mockReturnValueOnce(contactChain).mockResolvedValueOnce({
      data: [
        {
          role: 'Finance',
          is_primary: true,
          contacts: {
            id: 'p1',
            account_id: studio.id,
            full_name: 'Alex Hope',
            first_name: 'Alex',
            last_name: 'Hope',
            email: 'alex@hope.test',
            phone: '01234 567890',
          },
        },
        {
          role: 'Other workspace',
          is_primary: false,
          contacts: {
            id: 'p2',
            account_id: 'other-account',
            full_name: 'Skip Me',
            email: 'skip@test',
          },
        },
      ],
      error: null,
    });

    const from = vi.fn((table: string) =>
      table === 'client_contacts' ? contactChain : clientChain,
    );

    const detail = await getNativeClient({ from } as never, studio, 'c1');

    expect(from).toHaveBeenCalledWith('clients');
    expect(from).toHaveBeenCalledWith('client_contacts');
    expect(clientChain.eq).toHaveBeenCalledWith('account_id', studio.id);
    expect(clientChain.eq).toHaveBeenCalledWith('id', 'c1');
    expect(detail).toEqual({
      id: 'c1',
      name: 'Bracketts Ltd',
      email: 'hello@bracketts.test',
      company_name: 'Bracketts Ltd',
      client_type: 'business',
      image: 'https://cdn.example.com/bracketts.png',
      logo: 'https://cdn.example.com/bracketts.png',
      contacts: [
        {
          id: 'p1',
          name: 'Alex Hope',
          role: 'Finance',
          email: 'alex@hope.test',
          phone: '01234 567890',
          is_primary: true,
        },
      ],
    });
  });
});
