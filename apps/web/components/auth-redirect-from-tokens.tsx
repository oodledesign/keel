'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * If the user lands on the marketing home (/) with Supabase auth tokens in the URL
 * (e.g. after clicking the email confirmation link when Supabase redirects to Site URL),
 * redirect to /auth/callback so the server can verify and set the session.
 */
export function AuthRedirectFromTokens() {
  const router = useRouter();
  const pathname = usePathname();
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current || typeof window === 'undefined') return;
    if (pathname !== '/') return;

    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash.slice(1);
    const hashParams = new URLSearchParams(hash);

    const tokenHash =
      params.get('token_hash') ?? hashParams.get('token_hash');
    const type = params.get('type') ?? hashParams.get('type');

    if (tokenHash && type) {
      didRun.current = true;
      const callback = new URL('/auth/callback', window.location.origin);
      callback.searchParams.set('token_hash', tokenHash);
      callback.searchParams.set('type', type);
      const next = params.get('next') ?? hashParams.get('next');
      if (next) callback.searchParams.set('next', next);
      router.replace(callback.pathname + callback.search);
    }
  }, [pathname, router]);

  return null;
}
