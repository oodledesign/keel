export const MEMORY_NOTE_CATEGORY = 'memory';

export const MEMORY_KINDS = [
  'funny_quote',
  'milestone',
  'firsts',
  'holiday',
  'everyday',
  'school',
] as const;

export type MemoryKind = (typeof MEMORY_KINDS)[number];

export const MEMORY_KIND_LABELS: Record<MemoryKind, string> = {
  funny_quote: 'Funny quote',
  milestone: 'Milestone',
  firsts: 'Firsts',
  holiday: 'Holiday',
  everyday: 'Everyday',
  school: 'School',
};

export const MEMORY_KIND_TAG_PREFIX = 'mk:';

export function isMemoryKind(value: string): value is MemoryKind {
  return (MEMORY_KINDS as readonly string[]).includes(value);
}

export function memoryKindTag(kind: MemoryKind) {
  return `${MEMORY_KIND_TAG_PREFIX}${kind}`;
}

export function memoryKindFromTags(
  tags: string[] | null | undefined,
): MemoryKind | null {
  if (!tags?.length) return null;

  for (const tag of tags) {
    if (tag.startsWith(MEMORY_KIND_TAG_PREFIX)) {
      const slug = tag.slice(MEMORY_KIND_TAG_PREFIX.length);
      if (isMemoryKind(slug)) return slug;
    }
  }

  for (const tag of tags) {
    if (isMemoryKind(tag)) return tag;
  }

  return null;
}

export function withMemoryKindTags(
  tags: string[] | null | undefined,
  kind: MemoryKind | null,
) {
  const next = (tags ?? []).filter(
    (tag) => !tag.startsWith(MEMORY_KIND_TAG_PREFIX) && !isMemoryKind(tag),
  );

  if (kind) {
    next.unshift(memoryKindTag(kind));
  }

  return next;
}

export function isMemoryNoteCategory(category: string | null | undefined) {
  return category === MEMORY_NOTE_CATEGORY;
}

export function formatChildAge(
  dateOfBirth: string | null | undefined,
  now = new Date(),
): string | null {
  if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    return null;
  }

  const [year, month, day] = dateOfBirth.split('-').map(Number);
  if (!year || !month || !day) return null;

  const dob = new Date(year, month - 1, day);
  if (Number.isNaN(dob.getTime()) || dob > now) return null;

  let months =
    (now.getFullYear() - dob.getFullYear()) * 12 +
    (now.getMonth() - dob.getMonth());
  if (now.getDate() < dob.getDate()) {
    months -= 1;
  }
  if (months < 0) return null;

  if (months < 12) {
    if (months === 0) {
      const days = Math.max(
        1,
        Math.floor((now.getTime() - dob.getTime()) / 86_400_000),
      );
      return days === 1 ? '1 day old' : `${days} days old`;
    }

    return months === 1 ? '1 month old' : `${months} months old`;
  }

  const years = Math.floor(months / 12);
  return years === 1 ? '1 year old' : `${years} years old`;
}

export function memoryOccurredOn(
  occurredAt: string | null | undefined,
  createdAt: string,
) {
  if (occurredAt && /^\d{4}-\d{2}-\d{2}$/.test(occurredAt)) {
    return occurredAt;
  }

  return createdAt.slice(0, 10);
}

export function formatMemoryDay(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return isoDate;

  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

export function childInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);

  if (parts.length === 0) return '?';
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
}

export function todayIsoDate(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
