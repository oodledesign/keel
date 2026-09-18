export type NamedEmail = {
  name?: string | null;
  email?: string | null;
};

export function normalizeParticipantEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isUsableParticipantName(
  name: string | null | undefined,
  email: string,
): name is string {
  const trimmed = name?.trim() ?? '';
  if (!trimmed) return false;
  if (normalizeParticipantEmail(trimmed) === normalizeParticipantEmail(email)) {
    return false;
  }
  return trimmed.toLowerCase() !== 'guest';
}

export function displayNameFromEmailLocalPart(email: string) {
  const local = email.split('@')[0]?.trim() ?? '';
  if (!local) return null;

  const plusStripped = local.split('+')[0] ?? local;
  const parts = plusStripped.split(/[._-]+/).filter((part) => part.length > 0);
  if (parts.length === 0) return null;
  if (parts.every((part) => /^\d+$/.test(part))) return null;

  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function firstMatchingName(rows: NamedEmail[] | undefined, email: string) {
  const normalized = normalizeParticipantEmail(email);
  return (
    rows?.find(
      (row) =>
        Boolean(row.email) &&
        normalizeParticipantEmail(row.email ?? '') === normalized,
    )?.name ?? null
  );
}

export function resolveEmailParticipantName(
  email: string,
  sources: {
    contacts?: NamedEmail[];
    calendarAttendees?: NamedEmail[];
    members?: NamedEmail[];
  },
) {
  const candidates = [
    firstMatchingName(sources.contacts, email),
    firstMatchingName(sources.calendarAttendees, email),
    firstMatchingName(sources.members, email),
  ];

  for (const candidate of candidates) {
    if (isUsableParticipantName(candidate, email)) {
      return candidate.trim();
    }
  }

  return displayNameFromEmailLocalPart(email);
}

export function formatEmailParticipantLabel(
  name: string | null | undefined,
  email: string,
) {
  if (isUsableParticipantName(name, email)) {
    const displayName = name.trim();
    return {
      displayName,
      label: `${displayName} - ${email}`,
    };
  }

  return {
    displayName: null,
    label: email,
  };
}
