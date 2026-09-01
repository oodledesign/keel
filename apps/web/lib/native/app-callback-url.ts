export const NATIVE_APP_CALLBACK_HREF = 'so.ozer.app://auth-callback';

/**
 * Build the custom-scheme hop used after Mail opens the HTTPS bounce page.
 * `search` and `hash` should be `window.location.search` / `.hash` (including
 * their leading `?` / `#` when present). Tokens stay in the URL — never render them.
 */
export function buildNativeAppCallbackHref(search: string, hash: string) {
  return `${NATIVE_APP_CALLBACK_HREF}${search}${hash}`;
}

/**
 * True when the magic-link `callback` / `redirect_to` is the iPhone bounce,
 * not a web post-auth path. Those must not be verified in the browser —
 * `/auth/confirm` used to consume the token and then hop to the app empty.
 */
export function isNativeAuthCallback(callback: string | null | undefined) {
  if (!callback) {
    return false;
  }

  const trimmed = callback.trim();

  if (trimmed.startsWith('so.ozer.app://')) {
    return true;
  }

  if (
    trimmed === '/auth/native' ||
    trimmed.startsWith('/auth/native?') ||
    trimmed.startsWith('/auth/native/')
  ) {
    return true;
  }

  try {
    const url = new URL(trimmed);
    return url.pathname === '/auth/native' || url.pathname.startsWith('/auth/native/');
  } catch {
    return false;
  }
}

export function nativeAuthBouncePath(tokenHash: string, type: string) {
  const params = new URLSearchParams({
    token_hash: tokenHash,
    type,
  });

  return `/auth/native?${params.toString()}`;
}
