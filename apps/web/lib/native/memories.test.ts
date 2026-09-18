import { describe, expect, it } from 'vitest';

import { NativeHttpError } from './http';
import {
  isFamilyMemoriesWorkspace,
  parseNativeBirthday,
  parseNativeMemoryKind,
  parseNativeOccurredOn,
  requireFamilyMemoriesWorkspace,
  toNativeMemoriesPayload,
} from './memories-shared';
import type { NativeWorkspace } from './workspace-shared';

const family: NativeWorkspace = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'the-house',
  name: 'The House',
  profile: 'family',
  isPersonal: false,
  image: null,
};

const personal: NativeWorkspace = {
  id: '33333333-3333-4333-8333-333333333333',
  slug: '',
  name: 'Dan',
  profile: 'personal',
  isPersonal: true,
  image: null,
};

const studio: NativeWorkspace = {
  id: '22222222-2222-4222-8222-222222222222',
  slug: 'oodle',
  name: 'Oodle',
  profile: 'work_design',
  isPersonal: false,
  image: null,
};

describe('requireFamilyMemoriesWorkspace', () => {
  it('allows a family team workspace', () => {
    expect(isFamilyMemoriesWorkspace(family)).toBe(true);
    expect(() => requireFamilyMemoriesWorkspace(family)).not.toThrow();
  });

  it('rejects personal and business workspaces', () => {
    expect(isFamilyMemoriesWorkspace(personal)).toBe(false);
    expect(isFamilyMemoriesWorkspace(studio)).toBe(false);
    expect(() => requireFamilyMemoriesWorkspace(personal)).toThrow(
      NativeHttpError,
    );
    expect(() => requireFamilyMemoriesWorkspace(studio)).toThrow(
      NativeHttpError,
    );
  });
});

describe('parseNativeMemoryKind', () => {
  it('accepts known kinds and blank', () => {
    expect(parseNativeMemoryKind('funny_quote')).toBe('funny_quote');
    expect(parseNativeMemoryKind(null)).toBeNull();
    expect(parseNativeMemoryKind('')).toBeNull();
  });

  it('rejects unknown kinds', () => {
    expect(() => parseNativeMemoryKind('holiday-party')).toThrow(
      NativeHttpError,
    );
  });
});

describe('parseNativeOccurredOn', () => {
  it('accepts YYYY-MM-DD and defaults blank to today', () => {
    expect(parseNativeOccurredOn('2026-09-18')).toBe('2026-09-18');
    expect(parseNativeOccurredOn('')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('rejects junk', () => {
    expect(() => parseNativeOccurredOn('18/09/2026')).toThrow(NativeHttpError);
  });
});

describe('parseNativeBirthday', () => {
  it('treats blank as a clear', () => {
    expect(parseNativeBirthday('')).toBeNull();
    expect(parseNativeBirthday(null)).toBeNull();
    expect(parseNativeBirthday(undefined)).toBeUndefined();
    expect(parseNativeBirthday('2018-04-02')).toBe('2018-04-02');
  });
});

describe('toNativeMemoriesPayload', () => {
  it('uses snake_case and keeps People children, not household members', () => {
    const payload = toNativeMemoriesPayload({
      accountId: family.id,
      accountSlug: family.slug,
      people: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          accountId: family.id,
          fullName: 'Poet Potter',
          display_name: 'Poet',
          nickname: 'Poet',
          relationshipLabel: 'Child',
          is_child: true,
          date_of_birth: '2018-04-02',
          avatar_url: 'https://example.com/poet.jpg',
          avatarUrl: 'https://example.com/poet.jpg',
          ageLabel: '8 years old',
          memoryCount: 1,
        },
      ],
      children: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          accountId: family.id,
          fullName: 'Poet Potter',
          display_name: 'Poet',
          nickname: 'Poet',
          relationshipLabel: 'Child',
          is_child: true,
          date_of_birth: '2018-04-02',
          avatar_url: 'https://example.com/poet.jpg',
          avatarUrl: 'https://example.com/poet.jpg',
          ageLabel: '8 years old',
          memoryCount: 1,
        },
      ],
      memories: [
        {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          title: 'Moon biscuit',
          content: 'The moon was a biscuit.',
          occurredOn: '2026-09-18',
          kind: 'funny_quote',
          childIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
          children: [
            {
              id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              display_name: 'Poet',
              avatarUrl: 'https://example.com/poet.jpg',
            },
          ],
          media: [
            {
              id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
              title: 'photo.jpg',
              mimeType: 'image/jpeg',
              url: 'https://example.com/photo.jpg',
            },
          ],
          createdAt: '2026-09-18T10:00:00Z',
          updatedAt: '2026-09-18T10:00:00Z',
        },
      ],
    });

    expect(payload.account_id).toBe(family.id);
    expect(payload.children[0]?.is_child).toBe(true);
    expect(payload.children[0]?.display_name).toBe('Poet');
    expect(payload.memories[0]?.occurred_on).toBe('2026-09-18');
    expect(payload.memories[0]?.child_ids).toEqual([
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    ]);
    expect(payload.memories[0]?.media[0]?.mime_type).toBe('image/jpeg');
  });
});
