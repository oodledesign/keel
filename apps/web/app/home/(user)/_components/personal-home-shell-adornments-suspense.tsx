import { Suspense } from 'react';

import type { SupabaseClient } from '@supabase/supabase-js';

import { loadPersonalMobileNavShortcuts } from '~/lib/dashboard-shortcuts/load-shortcuts';
import { serializeWorkspaceFocusMap } from '~/lib/workspace-focus/serialize-focus-map';
import { loadWorkspaceFocusSettingsMap } from '~/lib/workspace-focus/load-workspace-focus-settings';

export type PersonalHomeShellAdornments = {
  mobileNavShortcuts: Awaited<ReturnType<typeof loadPersonalMobileNavShortcuts>>;
  focusSettingsByAccountId: ReturnType<typeof serializeWorkspaceFocusMap>;
};

async function loadPersonalHomeShellAdornments(params: {
  client: SupabaseClient;
  userId: string;
  focusAccountIds: string[];
}): Promise<PersonalHomeShellAdornments> {
  const [mobileNavShortcuts, focusSettings] = await Promise.all([
    loadPersonalMobileNavShortcuts(params.client, params.userId),
    loadWorkspaceFocusSettingsMap(
      params.client,
      params.userId,
      params.focusAccountIds,
    ),
  ]);

  return {
    mobileNavShortcuts,
    focusSettingsByAccountId: serializeWorkspaceFocusMap(focusSettings),
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
