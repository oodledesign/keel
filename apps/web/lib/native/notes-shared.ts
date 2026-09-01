export const NATIVE_MEETING_NOTE_CATEGORY = 'meeting_transcript';

export type NativeNote = {
  id: string;
  title: string;
  body: string;
  workspace: string;
  category: string;
  tags: string[];
  client_id: string | null;
  created_at: string;
  updated_at: string;
};

export function toNativeNote(input: {
  id: string;
  title: string;
  body: string;
  workspace: string;
  category?: string | null;
  tags?: string[] | null;
  clientId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}): NativeNote {
  const now = new Date().toISOString();
  return {
    id: input.id,
    title: input.title,
    body: input.body,
    workspace: input.workspace,
    category: input.category?.trim() || 'idea',
    tags: (input.tags ?? [])
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0),
    client_id: input.clientId?.trim() || null,
    created_at: input.createdAt ?? now,
    updated_at: input.updatedAt ?? now,
  };
}

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

export function nativeNoteTitleFromBody(
  body: string,
  fallback = 'Note',
): string {
  const line =
    body
      .split('\n')
      .map((part) => part.trim())
      .find(Boolean) ?? fallback;
  return line.slice(0, 120);
}
