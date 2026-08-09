import { Suspense } from 'react';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { loadPersonalMobileNavShortcuts } from '~/lib/dashboard-shortcuts/load-shortcuts';
import { countNeedsReplyEmailThreads } from '~/lib/email-assistant/count-needs-reply-threads';
import { loadWorkspaceFocusSettingsMap } from '~/lib/workspace-focus/load-workspace-focus-settings';
import { serializeWorkspaceFocusMap } from '~/lib/workspace-focus/serialize-focus-map';

export type PersonalHomeShellAdornments = {
  mobileNavShortcuts: Awaited<
    ReturnType<typeof loadPersonalMobileNavShortcuts>
  >;
  focusSettingsByAccountId: ReturnType<typeof serializeWorkspaceFocusMap>;
  emailNeedsReplyCount: number;
};

async function loadPersonalHomeShellAdornments(params: {
  client: SupabaseClient;
  userId: string;
  focusAccountIds: string[];
}): Promise<PersonalHomeShellAdornments> {
  const [mobileNavShortcuts, focusSettings, emailNeedsReplyCount] =
    await Promise.all([
      loadPersonalMobileNavShortcuts(params.client, params.userId),
      loadWorkspaceFocusSettingsMap(
        params.client,
        params.userId,
        params.focusAccountIds,
      ),
      (async () => {
        try {
          const admin = getSupabaseServerAdminClient();
          return await countNeedsReplyEmailThreads(admin, {
            userId: params.userId,
            mailboxKind: 'personal',
          });
        } catch {
          try {
            return await countNeedsReplyEmailThreads(params.client, {
              userId: params.userId,
              mailboxKind: 'personal',
            });
          } catch {
            return 0;
          }
        }
      })(),
    ]);

  return {
    mobileNavShortcuts,
    focusSettingsByAccountId: serializeWorkspaceFocusMap(focusSettings),
    emailNeedsReplyCount,
  };
}

type Props = {
  client: SupabaseClient;
  userId: string;
  focusAccountIds: string[];
  fallback: React.ReactNode;
  children: (adornments: PersonalHomeShellAdornments) => React.ReactNode;
};

async function PersonalHomeShellAdornmentsLoader({
  client,
  userId,
  focusAccountIds,
  children,
}: Omit<Props, 'fallback'>) {
  const adornments = await loadPersonalHomeShellAdornments({
    client,
    userId,
    focusAccountIds,
  });

  return <>{children(adornments)}</>;
}

export function PersonalHomeShellAdornmentsSuspense({
  fallback,
  children,
  ...loaderProps
}: Props) {
  return (
    <Suspense fallback={fallback}>
      <PersonalHomeShellAdornmentsLoader {...loaderProps}>
        {children}
      </PersonalHomeShellAdornmentsLoader>
    </Suspense>
  );
}
