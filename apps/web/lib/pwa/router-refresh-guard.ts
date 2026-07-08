import {
  isWorkspaceDashboardHome,
  normalizePublicPathname,
} from './normalize-public-pathname';

const REFRESH_COOLDOWN_MS = 5000;
const RSC_HEADER = 'rsc';
const NEXT_ROUTER_STATE_TREE_HEADER = 'next-router-state-tree';

let lastRefreshAt = 0;
let refreshInFlight = false;
let lastBlockedFetchAt = 0;
let fetchGuardInstalled = false;
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

function resolveFetchInputUrl(input: RequestInfo | URL): string | null {
  if (typeof input === 'string') {
    return input;
  }

  if (input instanceof URL) {
    return input.href;
  }

  if (input instanceof Request) {
    return input.url;
  }

  return null;
}

function isRscPostRequest(input: RequestInfo | URL, init?: RequestInit): boolean {
  const method = (
    init?.method ?? (input instanceof Request ? input.method : 'GET')
  ).toUpperCase();

  if (method !== 'POST') {
    return false;
  }

  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined),
  );

  return (
    headers.has(RSC_HEADER) ||
    headers.has(NEXT_ROUTER_STATE_TREE_HEADER) ||
    headers.has('RSC')
  );
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

/** Next.js server-action revalidation can bypass router.refresh; guard flight POSTs too. */
export function installDashboardRscRefreshFetchGuard() {
  if (typeof window === 'undefined' || fetchGuardInstalled) {
    return;
  }

  fetchGuardInstalled = true;

  const nativeFetch = window.fetch.bind(window);

  window.fetch = async function guardedFetch(input, init) {
    if (shouldBlockRouterRefresh() && isRscPostRequest(input, init)) {
      const url = resolveFetchInputUrl(input);

      if (url) {
        const pathname = normalizePublicPathname(
          new URL(url, window.location.origin).pathname,
        );

        if (isWorkspaceDashboardHome(pathname)) {
          const now = Date.now();

          if (now - lastBlockedFetchAt < REFRESH_COOLDOWN_MS) {
            return new Response('1:[]\n', {
              status: 200,
              headers: { 'content-type': 'text/x-component' },
            });
          }

          lastBlockedFetchAt = now;
          return new Response('1:[]\n', {
            status: 200,
            headers: { 'content-type': 'text/x-component' },
          });
        }
      }
    }

    return nativeFetch(input, init);
  };
}
