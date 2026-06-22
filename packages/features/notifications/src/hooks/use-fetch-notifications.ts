import { useEffect } from 'react';

import { useQuery } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';

import { Notification } from '../types';
import { useNotificationsStream } from './use-notifications-stream';

async function loadMutedNotificationIds(
  client: SupabaseClient,
  userId: string,
  notifications: Notification[],
): Promise<Set<number>> {
  if (notifications.length === 0) {
    return new Set();
  }

  const ids = notifications.map((row) => row.id);

  const { data } = await client
    .from('notification_user_mutes' as 'notifications')
    .select('notification_id')
    .eq('user_id', userId)
    .in('notification_id', ids);

  const mutedIds = new Set<number>();

  for (const row of (data ?? []) as Array<{ notification_id: number }>) {
    mutedIds.add(row.notification_id);
  }

  return mutedIds;
}

function withUserMutes(
  rows: Notification[],
  mutedIds: Set<number>,
): Notification[] {
  return rows.map((row) => ({
    ...row,
    muted: row.muted || mutedIds.has(row.id),
  }));
}

export function useFetchNotifications({
  onNotifications,
  accountIds,
  realtime,
  includeMuted = false,
}: {
  onNotifications: (notifications: Notification[]) => unknown;
  accountIds: string[];
  realtime: boolean;
  includeMuted?: boolean;
}) {
  const { data: initialNotifications } = useFetchInitialNotifications({
    accountIds,
    includeMuted,
  });

  useNotificationsStream({
    onNotifications,
    accountIds,
    enabled: realtime,
  });

  useEffect(() => {
    if (initialNotifications) {
      onNotifications(initialNotifications);
    }
  }, [initialNotifications, onNotifications]);
}

function useFetchInitialNotifications(props: {
  accountIds: string[];
  includeMuted: boolean;
}) {
  const client = useSupabase();
  const now = new Date().toISOString();

  return useQuery({
    queryKey: ['notifications', ...props.accountIds, props.includeMuted],
    queryFn: async () => {
      const {
        data: { user },
      } = await client.auth.getUser();

      let query = client
        .from('notifications')
        .select(
          `id,
           account_id,
           body,
           dismissed,
           muted,
           type,
           created_at,
           link`,
        )
        .in('account_id', props.accountIds)
        .eq('dismissed', false)
        .gt('expires_at', now)
        .order('created_at', { ascending: false })
        .limit(20);

      const { data } = await query;

      const rows = (data ?? []) as Notification[];

      if (!user) {
        return props.includeMuted
          ? rows
          : rows.filter((row) => !row.muted);
      }

      const mutedIds = await loadMutedNotificationIds(client, user.id, rows);
      const merged = withUserMutes(rows, mutedIds);

      return props.includeMuted
        ? merged
        : merged.filter((row) => !row.muted);
    },
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}
