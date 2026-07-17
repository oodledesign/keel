'use client';

import { useCallback, useMemo } from 'react';

import { NotificationsPopover } from '@kit/notifications/components';
import type { Notification } from '@kit/notifications/types';

import { useWorkspaceFocusSettingsMap } from '~/components/workspace-shell/workspace-focus-context';
import { markNotificationMutedAction } from '~/lib/notifications/mark-notification-muted-action';
import { shouldSurfaceNotificationForFocus } from '~/lib/notifications/surface-notification';

export function WorkspaceNotificationsPopover(params: {
  realtime: boolean;
  accountIds: string[];
  userId: string;
  onClick?: (notification: Notification) => void;
}) {
  const byAccountId = useWorkspaceFocusSettingsMap();

  const shouldSurfaceNotification = useCallback(
    async (notification: Notification) => {
      if (!notification.account_id) {
        return true;
      }

      const focusSettings = byAccountId.get(notification.account_id) ?? null;

      return shouldSurfaceNotificationForFocus(
        {
          id: Number(notification.id),
          account_id: notification.account_id,
        },
        params.userId,
        focusSettings,
      );
    },
    [byAccountId, params.userId],
  );

  const onNotificationSuppressed = useCallback(
    async (notification: Notification) => {
      if (!notification.account_id) {
        return;
      }

      await markNotificationMutedAction({
        id: Number(notification.id),
        account_id: notification.account_id,
      });
    },
    [],
  );

  const accountIds = useMemo(
    () => Array.from(new Set(params.accountIds)),
    [params.accountIds],
  );

  return (
    <NotificationsPopover
      accountIds={accountIds}
      realtime={params.realtime}
      onClick={params.onClick}
      shouldSurfaceNotification={shouldSurfaceNotification}
      onNotificationSuppressed={onNotificationSuppressed}
    />
  );
}
