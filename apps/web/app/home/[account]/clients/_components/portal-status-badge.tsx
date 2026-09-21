import { cn } from '@kit/ui/utils';

import type { ContactPortalAccessStatus } from '~/lib/clients/client-portal-invites.types';
import {
  portalStatusBadgeClass,
  portalStatusDisplayLabel,
} from '~/lib/clients/contact-portal-status';

type PortalStatusBadgeProps = {
  status?: ContactPortalAccessStatus | null;
  className?: string;
};

/**
 * Colour-coded client-portal access pill — agency client contacts table.
 * Active / Invited / Revoked only; not_invited renders nothing.
 */
export function PortalStatusBadge({
  status,
  className,
}: PortalStatusBadgeProps) {
  const label = portalStatusDisplayLabel(status);
  const colorClass = portalStatusBadgeClass(status);

  if (!label) return null;

  return (
    <span
      data-test={`portal-status-badge-${status}`}
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
        colorClass,
        className,
      )}
    >
      {label}
    </span>
  );
}
