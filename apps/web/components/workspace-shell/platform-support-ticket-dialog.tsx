'use client';

import { PlatformSupportMessenger } from '~/components/workspace-shell/platform-support-messenger';
import type { OpenPlatformSupportMessengerOptions } from '~/components/workspace-shell/platform-support-messenger-context';

type PlatformSupportTicketDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAccountId?: string | null;
  initialView?: OpenPlatformSupportMessengerOptions['view'];
};

/**
 * Intercom-style support messenger (kept under the historical Dialog name).
 * Prefer `usePlatformSupportMessenger()` from the shared provider when possible
 * so the profile menu and help FAB share one host.
 */
export function PlatformSupportTicketDialog({
  open,
  onOpenChange,
  defaultAccountId = null,
  initialView = 'home',
}: PlatformSupportTicketDialogProps) {
  return (
    <PlatformSupportMessenger
      open={open}
      onOpenChange={onOpenChange}
      defaultAccountId={defaultAccountId}
      initialView={initialView}
    />
  );
}
