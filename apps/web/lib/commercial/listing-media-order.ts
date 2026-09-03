/**
 * Stable presentation order for commercial listing media.
 *
 * `sort_order` is the source of truth (Media tab drag order). Tie-break by
 * `created_at` then `id` so duplicate or unset orders stay deterministic.
 */

export type ListingMediaSortable = {
  id?: string | null;
  sortOrder?: number | null;
  sort_order?: number | null;
  createdAt?: string | null;
  created_at?: string | null;
};

function mediaSortOrder(item: ListingMediaSortable): number {
  const value = item.sortOrder ?? item.sort_order;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function mediaCreatedAt(item: ListingMediaSortable): string {
  return item.createdAt ?? item.created_at ?? '';
}

function mediaId(item: ListingMediaSortable): string {
  return item.id ?? '';
}

export function compareListingMediaOrder(
  a: ListingMediaSortable,
  b: ListingMediaSortable,
): number {
  const orderDelta = mediaSortOrder(a) - mediaSortOrder(b);
  if (orderDelta !== 0) return orderDelta;

  const createdA = mediaCreatedAt(a);
  const createdB = mediaCreatedAt(b);
  if (createdA !== createdB) return createdA < createdB ? -1 : 1;

  const idA = mediaId(a);
  const idB = mediaId(b);
  if (idA !== idB) return idA < idB ? -1 : 1;

  return 0;
}

export function sortListingMedia<T extends ListingMediaSortable>(
  items: readonly T[],
): T[] {
  return items.slice().sort(compareListingMediaOrder);
}
