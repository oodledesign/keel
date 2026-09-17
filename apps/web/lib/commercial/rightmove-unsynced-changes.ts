import {
  LISTING_STATUS_LABELS,
  type ListingStatus,
} from '~/lib/commercial/commercial-constants';
import { formatRightmoveUpdatedAt } from '~/lib/commercial/rightmove-publish-status';

export type RightmoveUnsyncedMediaInput = {
  mediaType: string;
  isCover?: boolean;
  createdAt?: string | null;
  isPrivate?: boolean;
};

export type RightmoveUnsyncedStatusChangeInput = {
  previousStatus?: string | null;
  status?: string | null;
  createdAt: string;
};

export type RightmoveUnsyncedChangeItem = {
  id: string;
  text: string;
};

export type RightmoveUnsyncedChanges = {
  lastSyncAt: string | null;
  lastSyncText: string;
  items: RightmoveUnsyncedChangeItem[];
  footnote: string;
};

type ListingEventLike = {
  eventType: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
};

function parseTime(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function isAfterLastSync(
  value: string | null | undefined,
  lastSyncMs: number | null,
): boolean {
  const ms = parseTime(value);
  if (ms == null) return false;
  if (lastSyncMs == null) return false;
  return ms > lastSyncMs;
}

function formatListingStatusLabel(status: string | null | undefined): string {
  const key = status?.trim();
  if (!key) return 'Unknown';
  if (key in LISTING_STATUS_LABELS) {
    return LISTING_STATUS_LABELS[key as ListingStatus];
  }
  return key.replace(/_/g, ' ');
}

function mediaKindLabel(item: RightmoveUnsyncedMediaInput): string {
  if (item.mediaType === 'brochure') return 'brochure';
  if (item.mediaType === 'epc') return 'EPC';
  if (item.mediaType === 'floorplan') return 'floor plan';
  if (item.mediaType === 'video') return 'video';
  if (item.mediaType === 'aerial') return 'aerial photo';
  if (item.mediaType === 'goad') return 'Goad plan';
  if (item.mediaType === 'image' || item.mediaType === 'other') {
    return item.isCover ? 'main photo' : 'gallery photo';
  }
  return 'other file';
}

function pluralise(count: number, singular: string, plural: string) {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

function formatMediaKindCount(kind: string, count: number): string {
  switch (kind) {
    case 'main photo':
      return pluralise(count, 'main photo', 'main photos');
    case 'gallery photo':
      return pluralise(count, 'gallery photo', 'gallery photos');
    case 'brochure':
      return pluralise(count, 'brochure', 'brochures');
    case 'EPC':
      return pluralise(count, 'EPC', 'EPCs');
    case 'floor plan':
      return pluralise(count, 'floor plan', 'floor plans');
    case 'video':
      return pluralise(count, 'video', 'videos');
    case 'aerial photo':
      return pluralise(count, 'aerial photo', 'aerial photos');
    case 'Goad plan':
      return pluralise(count, 'Goad plan', 'Goad plans');
    default:
      return pluralise(count, 'other file', 'other files');
  }
}

function joinBritishList(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export function statusChangesFromListingEvents(
  events: ListingEventLike[],
): RightmoveUnsyncedStatusChangeInput[] {
  const changes: RightmoveUnsyncedStatusChangeInput[] = [];

  for (const event of events) {
    if (event.eventType !== 'status_changed') continue;
    const metadata = event.metadata ?? {};
    changes.push({
      previousStatus:
        typeof metadata.previousStatus === 'string'
          ? metadata.previousStatus
          : null,
      status: typeof metadata.status === 'string' ? metadata.status : null,
      createdAt: event.createdAt,
    });
  }

  return changes;
}

function formatStatusChange(
  change: RightmoveUnsyncedStatusChangeInput,
): string {
  const when = formatRightmoveUpdatedAt(change.createdAt);
  const from = change.previousStatus?.trim()
    ? formatListingStatusLabel(change.previousStatus)
    : null;
  const to = change.status?.trim()
    ? formatListingStatusLabel(change.status)
    : null;

  if (from && to) {
    return `Status changed from ${from} to ${to} (${when})`;
  }
  if (to) return `Status changed to ${to} (${when})`;
  return `Status changed (${when})`;
}

function describeNewMedia(
  media: RightmoveUnsyncedMediaInput[],
  lastSyncMs: number,
): string | null {
  const counts = new Map<string, number>();

  for (const item of media) {
    if (item.isPrivate) continue;
    if (!isAfterLastSync(item.createdAt, lastSyncMs)) continue;
    const kind = mediaKindLabel(item);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }

  if (counts.size === 0) return null;

  const parts = [...counts.entries()].map(([kind, count]) =>
    formatMediaKindCount(kind, count),
  );
  return `New media since last sync: ${joinBritishList(parts)}`;
}

/**
 * Honest Unsynced explanation from stored timestamps / events.
 * Does not invent field-level diffs — those are not stored.
 */
export function describeRightmoveUnsyncedChanges(input: {
  lastSyncAt?: string | null;
  listingUpdatedAt?: string | null;
  media?: RightmoveUnsyncedMediaInput[];
  statusChanges?: RightmoveUnsyncedStatusChangeInput[];
}): RightmoveUnsyncedChanges {
  const lastSyncAt = input.lastSyncAt?.trim() || null;
  const lastSyncMs = parseTime(lastSyncAt);
  const items: RightmoveUnsyncedChangeItem[] = [];

  const lastSyncText =
    lastSyncMs != null
      ? `Last synced ${formatRightmoveUpdatedAt(lastSyncAt)}`
      : 'No last-sync time is stored';

  if (lastSyncMs == null) {
    items.push({
      id: 'missing-last-sync',
      text: 'Rightmove is live but we have no last-sync time, so this listing is marked Unsynced until the next successful push',
    });

    if (parseTime(input.listingUpdatedAt) != null) {
      items.push({
        id: 'listing-updated',
        text: `Listing details last updated (${formatRightmoveUpdatedAt(input.listingUpdatedAt)})`,
      });
    }

    return {
      lastSyncAt,
      lastSyncText,
      items,
      footnote:
        'We do not keep a field-by-field comparison. These are the signals used to mark the listing Unsynced.',
    };
  }

  const recentStatusChanges = (input.statusChanges ?? [])
    .filter((change) => isAfterLastSync(change.createdAt, lastSyncMs))
    .sort((a, b) => (parseTime(b.createdAt) ?? 0) - (parseTime(a.createdAt) ?? 0))
    .slice(0, 3);

  for (const [index, change] of recentStatusChanges.entries()) {
    items.push({
      id: `status-${index}`,
      text: formatStatusChange(change),
    });
  }

  if (isAfterLastSync(input.listingUpdatedAt, lastSyncMs)) {
    items.push({
      id: 'listing-updated',
      text: `Listing details updated (${formatRightmoveUpdatedAt(input.listingUpdatedAt)})`,
    });
  }

  const mediaText = describeNewMedia(input.media ?? [], lastSyncMs);
  if (mediaText) {
    items.push({
      id: 'new-media',
      text: mediaText,
    });
  }

  if (items.length === 0) {
    items.push({
      id: 'stale-generic',
      text: 'The disposal or its media is newer than the last successful Rightmove push',
    });
  }

  return {
    lastSyncAt,
    lastSyncText,
    items,
    footnote:
      'We do not keep a field-by-field comparison. These are the signals used to mark the listing Unsynced.',
  };
}
