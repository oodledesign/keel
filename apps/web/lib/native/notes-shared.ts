export const NATIVE_MEETING_NOTE_CATEGORY = 'meeting_transcript';

export function isNativeMeetingNote(note: {
  category?: string | null;
  tags?: string[] | null;
}): boolean {
  if (note.category?.trim() === NATIVE_MEETING_NOTE_CATEGORY) {
    return true;
  }

  return (note.tags ?? []).some(
    (tag) => tag.trim().toLowerCase() === 'meeting',
  );
}

export function nativeNoteTitleFromBody(body: string, fallback = 'Note'): string {
  const line =
    body
      .split('\n')
      .map((part) => part.trim())
      .find(Boolean) ?? fallback;
  return line.slice(0, 120);
}
