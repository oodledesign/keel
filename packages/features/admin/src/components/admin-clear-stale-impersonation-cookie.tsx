'use client';

import { useEffect, useRef } from 'react';

import { clearStaleImpersonationCookieAction } from '../lib/server/admin-server-actions';

/**
 * Clears a leftover impersonation restore cookie when the session is no longer
 * active (e.g. after signing out from marketing while impersonating).
 * Must run as a client-triggered Server Action — RSC render cannot mutate cookies.
 */
export function AdminClearStaleImpersonationCookie() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void clearStaleImpersonationCookieAction({});
  }, []);

  return null;
}
