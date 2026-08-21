import {
  LISTING_ACTIVE_STATUSES,
  LISTING_STATUSES,
  type ListingStatus,
} from '~/lib/commercial/commercial-constants';

export type DisposalStatusFilter = 'active' | 'all' | ListingStatus;

const LISTING_STATUS_SET = new Set<string>(LISTING_STATUSES);

export function parseDisposalStatusFilter(
  raw: string | null | undefined,
): DisposalStatusFilter {
  if (!raw || raw === 'active') return 'active';
  if (raw === 'all') return 'all';
  if (LISTING_STATUS_SET.has(raw)) return raw as ListingStatus;
  return 'active';
}

export function disposalStatusQueryParams(filter: DisposalStatusFilter): {
  status?: ListingStatus;
  statuses?: ListingStatus[];
} {
  if (filter === 'all') {
    return { statuses: [...LISTING_STATUSES] };
  }
  if (filter === 'active') {
    return { statuses: [...LISTING_ACTIVE_STATUSES] };
  }
  return { status: filter };
}

export function listingMatchesDisposalStatus(
  status: string,
  filter: DisposalStatusFilter,
) {
  if (filter === 'all') return true;
  if (filter === 'active') {
    return (LISTING_ACTIVE_STATUSES as readonly string[]).includes(status);
  }
  return status === filter;
}
