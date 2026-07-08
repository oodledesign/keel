'use client';

import { useRouter } from 'next/navigation';

import { patchRouterRefresh } from '~/lib/pwa/router-refresh-guard';

/** Blocks runaway `router.refresh()` loops on the workspace dashboard home. */
export function RouterRefreshGuard() {
  const router = useRouter();
  patchRouterRefresh(router);

  return null;
}
