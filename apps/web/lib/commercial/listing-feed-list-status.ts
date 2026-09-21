import {
  getEachChannelStatus,
  getWebsiteChannelStatus,
} from '~/lib/commercial/channel-publish-status';

export const FEED_LIST_SYNC_STATUSES = [
  'live',
  'off',
  'blocked',
  'error',
] as const;

export type FeedListSyncStatus = (typeof FEED_LIST_SYNC_STATUSES)[number];

export type FeedListPublicationInput = {
  portal: string;
  status: string;
  lastError?: string | null;
};

export const FEED_LIST_SYNC_BADGE_CLASS: Record<
  ReturnType<typeof formatFeedListSyncStatus>,
  string
> = {
  Live: 'bg-emerald-100 text-emerald-900 ring-1 ring-inset ring-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-100 dark:ring-emerald-500/30',
  Included:
    'bg-emerald-100 text-emerald-900 ring-1 ring-inset ring-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-100 dark:ring-emerald-500/30',
  Off: 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]/55 ring-1 ring-inset ring-[color:var(--workspace-shell-border)]',
  Blocked:
    'bg-amber-100 text-amber-950 ring-1 ring-inset ring-amber-200/80 dark:bg-amber-500/15 dark:text-amber-100 dark:ring-amber-500/30',
  Error:
    'bg-rose-100 text-rose-900 ring-1 ring-inset ring-rose-200/80 dark:bg-rose-500/15 dark:text-rose-100 dark:ring-rose-500/30',
};

function isFeedListSyncStatus(
  status: string | null | undefined,
): status is FeedListSyncStatus {
  return (
    typeof status === 'string' &&
    (FEED_LIST_SYNC_STATUSES as readonly string[]).includes(status)
  );
}

export function resolveFeedListSyncStatusLabel(
  status: FeedListSyncStatus | string | null | undefined,
): FeedListSyncStatus {
  return isFeedListSyncStatus(status) ? status : 'off';
}

function isRecordedFeedError(publication?: FeedListPublicationInput) {
  return publication?.status === 'error';
}

function isIgnoredWebsiteCredentialError(lastError: string | null) {
  return Boolean(lastError && /credentials not configured/i.test(lastError));
}

export function resolveWebsiteListSyncStatus(input: {
  listing: {
    status: string;
    externalId: string | null;
    websiteUrl?: string | null;
  };
  publications: FeedListPublicationInput[];
}): FeedListSyncStatus {
  const publication = input.publications.find(
    (row) => row.portal === 'property_hive',
  );
  const channel = getWebsiteChannelStatus({
    listing: input.listing,
    publications: input.publications,
  });

  if (channel.state === 'off') return 'off';
  if (
    isRecordedFeedError(publication) &&
    !isIgnoredWebsiteCredentialError(publication?.lastError ?? null)
  ) {
    return 'error';
  }
  if (channel.state === 'live') return 'live';
  return 'blocked';
}

export function resolveEachListSyncStatus(input: {
  listing: {
    status: string;
    externalId: string | null;
    websiteUrl?: string | null;
    sizeMinSqft?: number | null;
    name?: string | null;
    postcode?: string | null;
    disposalType?: string | null;
  };
  publications: FeedListPublicationInput[];
}): FeedListSyncStatus {
  const publication = input.publications.find((row) => row.portal === 'each');
  const channel = getEachChannelStatus({
    listing: input.listing,
    publications: input.publications,
  });

  if (channel.state === 'off') return 'off';
  if (isRecordedFeedError(publication)) return 'error';
  if (channel.state === 'live') return 'live';
  return 'blocked';
}

function assertNever(value: never): never {
  throw new Error(`Unexpected feed list status: ${String(value)}`);
}

export function formatWebsiteListSyncStatus(
  status: FeedListSyncStatus | string | null | undefined,
) {
  const resolved = resolveFeedListSyncStatusLabel(status);
  switch (resolved) {
    case 'live':
      return 'Live';
    case 'off':
      return 'Off';
    case 'blocked':
      return 'Blocked';
    case 'error':
      return 'Error';
    default:
      return assertNever(resolved);
  }
}

export function formatEachListSyncStatus(
  status: FeedListSyncStatus | string | null | undefined,
) {
  const resolved = resolveFeedListSyncStatusLabel(status);
  switch (resolved) {
    case 'live':
      return 'Included';
    case 'off':
      return 'Off';
    case 'blocked':
      return 'Blocked';
    case 'error':
      return 'Error';
    default:
      return assertNever(resolved);
  }
}

export function formatFeedListSyncStatus(
  channel: 'website' | 'each',
  status: FeedListSyncStatus | string | null | undefined,
) {
  return channel === 'each'
    ? formatEachListSyncStatus(status)
    : formatWebsiteListSyncStatus(status);
}

export function feedListSyncBadgeClass(
  channel: 'website' | 'each',
  status: FeedListSyncStatus | string | null | undefined,
) {
  return FEED_LIST_SYNC_BADGE_CLASS[formatFeedListSyncStatus(channel, status)];
}

export function feedListSyncTitle(
  channel: 'website' | 'each',
  status: FeedListSyncStatus | string | null | undefined,
) {
  const channelLabel = channel === 'each' ? 'EACH' : 'Website';
  if (!isFeedListSyncStatus(status)) {
    return `${channelLabel} status unavailable`;
  }

  return `${channelLabel}: ${formatFeedListSyncStatus(channel, status)}. ${feedListSyncDetail(channel, status)}`;
}

export function feedListSyncDetail(
  channel: 'website' | 'each',
  status: FeedListSyncStatus | string | null | undefined,
) {
  const resolved = resolveFeedListSyncStatusLabel(status);
  if (channel === 'each') {
    switch (resolved) {
      case 'live':
        return 'Included in the EACH feed when on-market';
      case 'off':
        return 'Excluded from the EACH feed';
      case 'blocked':
        return 'Not exporting to EACH yet';
      case 'error':
        return 'EACH feed recorded an error';
      default:
        return assertNever(resolved);
    }
  }

  switch (resolved) {
    case 'live':
      return 'In the website feed — site updates after Property Hive imports';
    case 'off':
      return 'Not on the website feed';
    case 'blocked':
      return 'Not publishing to the website yet';
    case 'error':
      return 'Website feed recorded an error';
    default:
      return assertNever(resolved);
  }
}
