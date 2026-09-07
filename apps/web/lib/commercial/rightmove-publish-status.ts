import { isSafeHttpUrl } from '~/lib/commercial/channel-publish-status';

export type RightmoveDisposalStatusRow = {
  listingId: string;
  name: string;
  listingStatus: string;
  rightmoveStatus: string;
  externalId: string | null;
  urls: string[];
  lastUpdatedAt: string | null;
  lastError: string | null;
};

export function collectRightmoveUrls(input: {
  externalUrl?: string | null;
  metadata?: Record<string, unknown> | null;
}): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const add = (value: unknown) => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed || !isSafeHttpUrl(trimmed) || seen.has(trimmed)) return;
    seen.add(trimmed);
    urls.push(trimmed);
  };

  add(input.externalUrl);

  const metadata = input.metadata ?? {};
  add(metadata.displayUrl);
  add(metadata.externalUrl);

  const links = metadata.links;
  if (links && typeof links === 'object') {
    for (const value of Object.values(links as Record<string, unknown>)) {
      add(value);
    }
  }

  return urls;
}

export function formatRightmoveUpdatedAt(
  iso: string | null | undefined,
): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRightmovePublicationStatus(
  status: string | null | undefined,
) {
  switch (status) {
    case 'published':
      return 'Published';
    case 'unpublished':
      return 'Removed';
    case 'error':
      return 'Failed';
    case 'draft':
      return 'Draft';
    default:
      return 'Not pushed';
  }
}

export function isRightmoveDisposalFailed(
  row: Pick<RightmoveDisposalStatusRow, 'rightmoveStatus' | 'lastError'>,
): boolean {
  return row.rightmoveStatus === 'error' || Boolean(row.lastError?.trim());
}

function rightmoveStatusRank(row: RightmoveDisposalStatusRow): number {
  if (row.rightmoveStatus === 'error') return 0;
  if (row.lastError?.trim()) return 1;
  if (row.rightmoveStatus === 'none' || !row.rightmoveStatus) return 3;
  if (row.rightmoveStatus === 'published') return 4;
  return 2;
}

export function sortRightmoveDisposalRows(
  rows: RightmoveDisposalStatusRow[],
): RightmoveDisposalStatusRow[] {
  return [...rows].sort((a, b) => {
    const rank = rightmoveStatusRank(a) - rightmoveStatusRank(b);
    if (rank !== 0) return rank;
    return a.name.localeCompare(b.name, 'en');
  });
}
