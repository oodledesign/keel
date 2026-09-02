import { describe, expect, it } from 'vitest';

import {
  NATIVE_MEETING_NOTE_CATEGORY,
  isNativeMeetingNote,
  isNativeSystemNoteCategory,
  mergeNativeNoteCategories,
  nativeNoteCategoryLabel,
  nativeNoteTitleFromBody,
  toNativeNote,
} from './notes-shared';

describe('isNativeMeetingNote', () => {
  it('recognises the meeting_transcript category', () => {
    expect(
      isNativeMeetingNote({ category: NATIVE_MEETING_NOTE_CATEGORY }),
    ).toBe(true);
  });

  it('recognises a meeting tag', () => {
    expect(isNativeMeetingNote({ tags: ['Meeting'] })).toBe(true);
  });

  it('ignores ordinary notes', () => {
    expect(isNativeMeetingNote({ category: 'idea', tags: ['field'] })).toBe(
      false,
    );
  });
});

describe('nativeNoteTitleFromBody', () => {
  it('uses the first non-empty line', () => {
    expect(nativeNoteTitleFromBody('\nMe\n\nSite notes')).toBe('Me');
  });

  it('falls back when the body is blank', () => {
    expect(nativeNoteTitleFromBody('   ')).toBe('Note');
  });
});

describe('native note categories', () => {
  it('keeps the web system slugs', () => {
    expect(isNativeSystemNoteCategory('idea')).toBe(true);
    expect(isNativeSystemNoteCategory('future')).toBe(true);
    expect(isNativeSystemNoteCategory('development')).toBe(true);
    expect(isNativeSystemNoteCategory(NATIVE_MEETING_NOTE_CATEGORY)).toBe(true);
    expect(isNativeSystemNoteCategory('research')).toBe(false);
  });

  it('uses the web labels', () => {
    expect(nativeNoteCategoryLabel('idea')).toBe('Idea');
    expect(nativeNoteCategoryLabel(NATIVE_MEETING_NOTE_CATEGORY)).toBe(
      'Meeting transcript',
    );
    expect(nativeNoteCategoryLabel('site_visit')).toBe('Site Visit');
  });

  it('merges custom slugs after the system list', () => {
    const merged = mergeNativeNoteCategories(
      [
        { slug: 'research', label: 'Research' },
        { slug: 'idea', label: 'Should not replace' },
      ],
      'legacy_kind',
    );

    expect(merged.map((item) => item.slug)).toEqual([
      'idea',
      'future',
      'development',
      NATIVE_MEETING_NOTE_CATEGORY,
      'research',
      'legacy_kind',
    ]);
    expect(merged.find((item) => item.slug === 'research')).toEqual({
      slug: 'research',
      label: 'Research',
      is_custom: true,
    });
  });
});

describe('toNativeNote', () => {
  it('passes client_id through for a meeting transcript', () => {
    expect(
      toNativeNote({
        id: 'note-1',
        title: 'Site visit',
        body: 'Me\n\nWe walked the roof.',
        workspace: 'oodle',
        category: NATIVE_MEETING_NOTE_CATEGORY,
        tags: ['meeting'],
        clientId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        createdAt: '2026-09-01T12:00:00.000Z',
        updatedAt: '2026-09-01T12:00:00.000Z',
      }),
    ).toEqual({
      id: 'note-1',
      title: 'Site visit',
      body: 'Me\n\nWe walked the roof.',
      workspace: 'oodle',
      category: NATIVE_MEETING_NOTE_CATEGORY,
      tags: ['meeting'],
      client_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      client_name: null,
      created_at: '2026-09-01T12:00:00.000Z',
      updated_at: '2026-09-01T12:00:00.000Z',
    });
  });

  it('leaves client_id null when omitted', () => {
    expect(
      toNativeNote({
        id: 'note-2',
        title: 'Note',
        body: 'Hello',
        workspace: 'oodle',
      }).client_id,
    ).toBeNull();
  });

  it('passes client_name through when provided', () => {
    expect(
      toNativeNote({
        id: 'note-3',
        title: 'Note',
        body: 'Hello',
        workspace: 'oodle',
        clientId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        clientName: 'Bracketts',
      }).client_name,
    ).toBe('Bracketts');
  });
});
