import { cn } from '@kit/ui/utils';

import {
  formatRightmoveListSyncStatus,
  resolveRightmoveListSyncStatusLabel,
  rightmoveListSyncBadgeClass,
} from '~/lib/commercial/rightmove-publish-status';

export function RightmovePublicationStatusBadge({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  const resolved = resolveRightmoveListSyncStatusLabel(status);
  const label = formatRightmoveListSyncStatus(resolved);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium',
        rightmoveListSyncBadgeClass(resolved),
        className,
      )}
      data-test={`rightmove-status-pill-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {label}
    </span>
  );
}
