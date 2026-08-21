import { cn } from '@kit/ui/utils';

import {
  LISTING_STATUSES,
  LISTING_STATUS_BADGE_CLASS,
  LISTING_STATUS_LABELS,
  type ListingStatus,
} from '~/lib/commercial/commercial-constants';

export function isListingStatus(value: string): value is ListingStatus {
  return (LISTING_STATUSES as readonly string[]).includes(value);
}

type ListingStatusBadgeProps = {
  status: ListingStatus | string;
  className?: string;
  /** Slightly larger padding for select triggers / denser rows. */
  size?: 'sm' | 'md';
};

/**
 * Colour-coded disposal status pill — shared list cards, edit selects, headers.
 */
export function ListingStatusBadge({
  status,
  className,
  size = 'sm',
}: ListingStatusBadgeProps) {
  const known = isListingStatus(status) ? status : null;
  const label = known
    ? LISTING_STATUS_LABELS[known]
    : status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const colorClass = known
    ? LISTING_STATUS_BADGE_CLASS[known]
    : 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]/70 ring-1 ring-inset ring-[color:var(--workspace-shell-border)]';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        size === 'sm' && 'px-2.5 py-0.5 text-[11px]',
        size === 'md' && 'px-3 py-1 text-xs',
        colorClass,
        className,
      )}
    >
      {label}
    </span>
  );
}
