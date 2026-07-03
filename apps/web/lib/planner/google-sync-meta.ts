const GID_PREFIX = 'gid:';
const GCAL_PREFIX = 'gcal:';
const GPUSHED = 'gpushed';

export type GoogleSyncMeta = {
  googleEventId: string | null;
  googleCalendarId: string | null;
  pushedByPlanner: boolean;
  displayMeta: string[];
};

export function parseGoogleSyncMeta(meta: string[]): GoogleSyncMeta {
  let googleEventId: string | null = null;
  let googleCalendarId: string | null = null;
  let pushedByPlanner = false;
  const displayMeta: string[] = [];

  for (const part of meta) {
    const trimmed = part.trim();
    if (trimmed.startsWith(GID_PREFIX)) {
      googleEventId = trimmed.slice(GID_PREFIX.length).trim() || null;
      continue;
    }
    if (trimmed.startsWith(GCAL_PREFIX)) {
      googleCalendarId = trimmed.slice(GCAL_PREFIX.length).trim() || null;
      continue;
    }
    if (trimmed === GPUSHED) {
      pushedByPlanner = true;
      continue;
    }
    displayMeta.push(part);
  }

  return { googleEventId, googleCalendarId, pushedByPlanner, displayMeta };
}

export function googleSyncMetaParts(input: {
  googleEventId?: string | null;
  googleCalendarId?: string | null;
  pushedByPlanner?: boolean;
}): string[] {
  const parts: string[] = [];
  if (input.googleEventId?.trim()) {
    parts.push(`${GID_PREFIX}${input.googleEventId.trim()}`);
  }
  if (input.googleCalendarId?.trim()) {
    parts.push(`${GCAL_PREFIX}${input.googleCalendarId.trim()}`);
  }
  if (input.pushedByPlanner) {
    parts.push(GPUSHED);
  }
  return parts;
}

export function isSyncMetaPart(part: string): boolean {
  const trimmed = part.trim();
  return (
    trimmed.startsWith(GID_PREFIX) ||
    trimmed.startsWith(GCAL_PREFIX) ||
    trimmed === GPUSHED
  );
}
