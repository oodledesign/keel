import { cn } from '@kit/ui/utils';

import {
  formatRightmovePublicationStatus,
  rightmovePublicationStatusBadgeClass,
} from '~/lib/commercial/rightmove-publish-status';

export function RightmovePublicationStatusBadge({
  status,
  outOfSync = false,
  className,
}: {
  status: string | null | undefined;
  outOfSync?: boolean;
  className?: string;
}) {
  const options = { outOfSync };
  const label = formatRightmovePublicationStatus(status, options);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium',
        rightmovePublicationStatusBadgeClass(status, options),
        className,
      )}
      data-test={`rightmove-status-pill-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {label}
    </span>
  );
}
