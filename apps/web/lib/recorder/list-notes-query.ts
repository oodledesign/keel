const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CATEGORY_RE = /^[a-z0-9_]{1,64}$/;
const SEARCH_MAX_LENGTH = 200;

export const RECORDER_NOTES_MAX_PAGE = 50;

export type RecorderNotesClientFilter = string | 'none' | undefined;

export type RecorderNotesListQuery = {
  limit: number;
  offset: number;
  accountId: string | null;
  clientId: RecorderNotesClientFilter;
  category: string | null;
  q: string | null;
};

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function sanitizeRecorderNotesSearch(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim().slice(0, SEARCH_MAX_LENGTH);
  if (!trimmed) return null;
  const escaped = trimmed
    .replace(/[%_,.()\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return escaped || null;
}

export function parseRecorderNotesClientFilter(
  value: string | null | undefined,
): RecorderNotesClientFilter {
  if (value == null) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed === 'none' || trimmed === 'unassigned') return 'none';
  if (!UUID_RE.test(trimmed)) return undefined;
  return trimmed;
}

export function parseRecorderNotesCategory(value: string | null | undefined) {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed || !CATEGORY_RE.test(trimmed)) return null;
  return trimmed;
}

export function parseRecorderNotesListQuery(
  searchParams: URLSearchParams,
): RecorderNotesListQuery {
  const limit = Math.min(
    Math.max(parsePositiveInt(searchParams.get('limit'), 20), 1),
    RECORDER_NOTES_MAX_PAGE,
  );
  const offset = Math.max(parsePositiveInt(searchParams.get('offset'), 0), 0);
  const accountId = searchParams.get('account_id')?.trim() || null;

  return {
    limit,
    offset,
    accountId,
    clientId: parseRecorderNotesClientFilter(searchParams.get('client_id')),
    category: parseRecorderNotesCategory(searchParams.get('category')),
    q: sanitizeRecorderNotesSearch(searchParams.get('q')),
  };
}
