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

export function formatRightmoveUpdatedAt(iso: string | null | undefined): string {
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

export function formatRightmovePublicationStatus(status: string | null | undefined) {
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
