import { cn } from '@kit/ui/utils';

import {
  formatRightmovePublicationStatus,
  rightmovePublicationStatusBadgeClass,
} from '~/lib/commercial/rightmove-publish-status';

export function RightmovePublicationStatusBadge({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  const label = formatRightmovePublicationStatus(status);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium',
        rightmovePublicationStatusBadgeClass(status),
        className,
      )}
      data-test={`rightmove-status-pill-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {label}
    </span>
  );
}
