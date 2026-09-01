import { describe, expect, it } from 'vitest';

import {
  NATIVE_MEETING_NOTE_CATEGORY,
  isNativeMeetingNote,
  nativeNoteTitleFromBody,
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
