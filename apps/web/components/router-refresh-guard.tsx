'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import {
  installDashboardRscRefreshFetchGuard,
  patchRouterRefresh,
} from '~/lib/pwa/router-refresh-guard';

/** Blocks runaway `router.refresh()` loops on the workspace dashboard home. */
export function RouterRefreshGuard() {
  const router = useRouter();

  useEffect(() => {
    installDashboardRscRefreshFetchGuard();
  }, []);

  patchRouterRefresh(router);

  return null;
}
