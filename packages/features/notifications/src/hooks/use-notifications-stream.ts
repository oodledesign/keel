import { useEffect } from 'react';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';

import { Notification } from '../types';

export function useNotificationsStream({
  onNotifications,
  accountIds,
  enabled,
}: {
  onNotifications: (notifications: Notification[]) => void;
  accountIds: string[];
  enabled: boolean;
}) {
  const client = useSupabase();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const channel = client.channel('notifications-channel');

    const subscription = channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          filter: `account_id=in.(${accountIds.join(',')})`,
          table: 'notifications',
        },
        (payload) => {
          const row = payload.new as Notification & { channel?: string };

          if (row.channel && row.channel !== 'in_app') {
            return;
          }

          onNotifications([row]);
        },
      )
      .subscribe();

    return () => {
      void subscription?.unsubscribe();
    };
  }, [client, onNotifications, accountIds, enabled]);
}
