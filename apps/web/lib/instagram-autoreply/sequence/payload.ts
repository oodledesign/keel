/**
 * Postback / quick-reply payloads: `igrun:{runId}:{position}:{choice}`.
 * The run id ties a tap to exactly one run so stale or replayed taps are ignored.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildRunPayload(
  runId: string,
  position: number,
  choice: number,
): string {
  return `igrun:${runId}:${position}:${choice}`;
}

export type ParsedRunPayload = {
  runId: string;
  position: number;
  choice: number;
};

export function parseRunPayload(payload: string): ParsedRunPayload | null {
  const parts = payload.trim().split(':');
  if (parts.length !== 4 || parts[0] !== 'igrun') return null;
  const [, runId, positionRaw, choiceRaw] = parts;
  if (!runId || !UUID_RE.test(runId)) return null;
  const position = Number(positionRaw);
  const choice = Number(choiceRaw);
  if (!Number.isInteger(position) || position < 0) return null;
  if (!Number.isInteger(choice) || choice < 0) return null;
  return { runId, position, choice };
}

/** Follow-gate re-check: `igfollow:{runId}`. */
export function buildFollowCheckPayload(runId: string): string {
  return `igfollow:${runId}`;
}

export function parseFollowCheckPayload(payload: string): string | null {
  const parts = payload.trim().split(':');
  if (parts.length !== 2 || parts[0] !== 'igfollow') return null;
  return parts[1] && UUID_RE.test(parts[1]) ? parts[1] : null;
}

/** Ice breaker / persistent menu entry: `igentry:{triggerId}`. */
export function buildEntryPayload(triggerId: string): string {
  return `igentry:${triggerId}`;
}

export function parseEntryPayload(payload: string): string | null {
  const parts = payload.trim().split(':');
  if (parts.length !== 2 || parts[0] !== 'igentry') return null;
  return parts[1] && UUID_RE.test(parts[1]) ? parts[1] : null;
}

/** Fill `{{username}}` / `{{name}}` placeholders. */
export function renderTemplate(
  text: string,
  vars: { username?: string | null; name?: string | null },
): string {
  return text
    .replace(
      /\{\{\s*username\s*\}\}/gi,
      vars.username ? `@${vars.username}` : '',
    )
    .replace(
      /\{\{\s*(first_)?name\s*\}\}/gi,
      vars.name?.split(' ')[0] ?? vars.username ?? 'there',
    )
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
