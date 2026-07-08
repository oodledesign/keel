import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import {
  patchRouterRefresh,
  shouldBlockRouterRefresh,
} from './router-refresh-guard';

function mockWindowPathname(pathname: string) {
  vi.stubGlobal('window', {
    location: { pathname },
    setTimeout,
  });
}

describe('shouldBlockRouterRefresh', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('blocks refresh on workspace dashboard home', () => {
    mockWindowPathname('/app/oodle');
    expect(shouldBlockRouterRefresh()).toBe(true);
  });

  it('allows refresh on nested workspace routes', () => {
    mockWindowPathname('/app/oodle/tasks');
    expect(shouldBlockRouterRefresh()).toBe(false);
  });
});

describe('patchRouterRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does not call native refresh on dashboard home', () => {
    mockWindowPathname('/app/oodle');

    const nativeRefresh = vi.fn();
    const router = { refresh: nativeRefresh };

    patchRouterRefresh(router);
    router.refresh();

    expect(nativeRefresh).not.toHaveBeenCalled();
  });

  it('rate-limits refresh on other routes', () => {
    mockWindowPathname('/app/oodle/tasks');

    const nativeRefresh = vi.fn();
    const router = { refresh: nativeRefresh };

    patchRouterRefresh(router);
    router.refresh();
    router.refresh();

    expect(nativeRefresh).toHaveBeenCalledTimes(1);
  });
});
