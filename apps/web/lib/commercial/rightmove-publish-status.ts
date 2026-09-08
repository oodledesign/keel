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

/** Semantic pill classes for Rightmove publication status. */
export const RIGHTMOVE_PUBLICATION_STATUS_BADGE_CLASS: Record<
  ReturnType<typeof formatRightmovePublicationStatus>,
  string
> = {
  Published:
    'bg-emerald-100 text-emerald-900 ring-1 ring-inset ring-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-100 dark:ring-emerald-500/30',
  Failed:
    'bg-rose-100 text-rose-900 ring-1 ring-inset ring-rose-200/80 dark:bg-rose-500/15 dark:text-rose-100 dark:ring-rose-500/30',
  'Not pushed':
    'bg-amber-100 text-amber-950 ring-1 ring-inset ring-amber-200/80 dark:bg-amber-500/15 dark:text-amber-100 dark:ring-amber-500/30',
  Removed:
    'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]/70 ring-1 ring-inset ring-[color:var(--workspace-shell-border)]',
  Draft:
    'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200/80 dark:bg-slate-500/15 dark:text-slate-200 dark:ring-slate-500/30',
};

export function rightmovePublicationStatusBadgeClass(
  status: string | null | undefined,
) {
  return RIGHTMOVE_PUBLICATION_STATUS_BADGE_CLASS[
    formatRightmovePublicationStatus(status)
  ];
}
