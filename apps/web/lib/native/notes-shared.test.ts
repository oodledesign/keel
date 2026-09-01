import { describe, expect, it } from 'vitest';

import {
  NATIVE_MEETING_NOTE_CATEGORY,
  isNativeMeetingNote,
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
});
