'use client';

import { PlatformSupportMessenger } from '~/components/workspace-shell/platform-support-messenger';

type PlatformSupportTicketDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAccountId?: string | null;
};

/**
 * Intercom-style support messenger (kept under the historical Dialog name so
 * existing workspace shell call sites stay stable).
 */
export function PlatformSupportTicketDialog({
  open,
  onOpenChange,
  defaultAccountId = null,
}: PlatformSupportTicketDialogProps) {
  return (
    <PlatformSupportMessenger
      open={open}
      onOpenChange={onOpenChange}
      defaultAccountId={defaultAccountId}
    />
  );
}
