import {
  isWorkspaceDashboardHome,
  normalizePublicPathname,
} from './normalize-public-pathname';

const REFRESH_COOLDOWN_MS = 5000;

let lastRefreshAt = 0;
let refreshInFlight = false;
const patchedRouters = new WeakSet<object>();

function resolveCurrentPathname(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return normalizePublicPathname(window.location.pathname);
}

export function shouldBlockRouterRefresh(): boolean {
  return isWorkspaceDashboardHome(resolveCurrentPathname());
}

type RefreshableRouter = {
  refresh: () => void;
};

export function patchRouterRefresh(router: RefreshableRouter) {
  if (patchedRouters.has(router)) {
    return;
  }

  patchedRouters.add(router);

  const nativeRefresh = router.refresh.bind(router);

  router.refresh = function guardedRefresh() {
    if (refreshInFlight || shouldBlockRouterRefresh()) {
      return;
    }

    const now = Date.now();
    if (now - lastRefreshAt < REFRESH_COOLDOWN_MS) {
      return;
    }

    lastRefreshAt = now;
    refreshInFlight = true;
    nativeRefresh();

    window.setTimeout(() => {
      refreshInFlight = false;
    }, 1000);
  };
}
