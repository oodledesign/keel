import { describe, expect, it } from 'vitest';

import { isNoteEditorRoute } from './is-note-editor-route';

describe('isNoteEditorRoute', () => {
  it('matches personal and team note editors, including /new', () => {
    expect(isNoteEditorRoute('/app/notes/new')).toBe(true);
    expect(isNoteEditorRoute('/app/notes/abc-123')).toBe(true);
    expect(isNoteEditorRoute('/home/notes/abc-123')).toBe(true);
    expect(isNoteEditorRoute('/app/oodle/notes/new')).toBe(true);
    expect(isNoteEditorRoute('/app/oodle/notes/abc-123')).toBe(true);
    expect(isNoteEditorRoute('/home/oodle/notes/abc-123/')).toBe(true);
  });

  it('does not match the notes list or unrelated routes', () => {
    expect(isNoteEditorRoute('/app/notes')).toBe(false);
    expect(isNoteEditorRoute('/app/notes/')).toBe(false);
    expect(isNoteEditorRoute('/home/oodle/notes')).toBe(false);
    expect(isNoteEditorRoute('/app/oodle/community/notes')).toBe(false);
    expect(isNoteEditorRoute('/app/oodle/tasks')).toBe(false);
  });
});
