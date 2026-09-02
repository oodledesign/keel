export const NATIVE_MEETING_NOTE_CATEGORY = 'meeting_transcript';

/** Same system slugs and labels as the web notes picker. Do not invent extras. */
export const NATIVE_NOTE_SYSTEM_CATEGORIES = [
  { slug: 'idea', label: 'Idea', is_custom: false },
  { slug: 'future', label: 'Future', is_custom: false },
  { slug: 'development', label: 'Development', is_custom: false },
  {
    slug: NATIVE_MEETING_NOTE_CATEGORY,
    label: 'Meeting transcript',
    is_custom: false,
  },
] as const;

export const NATIVE_NOTE_CATEGORY_SLUG_RE = /^[a-z0-9_]{1,64}$/;

export type NativeNoteCategory = {
  slug: string;
  label: string;
  is_custom: boolean;
};

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

export function isNativeSystemNoteCategory(slug: string): boolean {
  return NATIVE_NOTE_SYSTEM_CATEGORIES.some((item) => item.slug === slug);
}

export function nativeNoteCategoryLabel(slug: string): string {
  const system = NATIVE_NOTE_SYSTEM_CATEGORIES.find(
    (item) => item.slug === slug,
  );
  if (system) {
    return system.label;
  }

  return slug.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function mergeNativeNoteCategories(
  custom: Array<{ slug: string; label: string }>,
  currentSlug?: string | null,
): NativeNoteCategory[] {
  const items: NativeNoteCategory[] = NATIVE_NOTE_SYSTEM_CATEGORIES.map(
    (item) => ({
      slug: item.slug,
      label: item.label,
      is_custom: false,
    }),
  );

  for (const row of custom) {
    const slug = row.slug.trim();
    if (!slug || items.some((item) => item.slug === slug)) {
      continue;
    }

    items.push({
      slug,
      label: row.label.trim() || nativeNoteCategoryLabel(slug),
      is_custom: true,
    });
  }

  const current = currentSlug?.trim() ?? '';
  if (current && !items.some((item) => item.slug === current)) {
    items.push({
      slug: current,
      label: nativeNoteCategoryLabel(current),
      is_custom: false,
    });
  }

  return items;
}

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
