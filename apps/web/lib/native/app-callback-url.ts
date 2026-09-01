export const NATIVE_APP_CALLBACK_HREF = 'so.ozer.app://auth-callback';

/**
 * Build the custom-scheme hop used after Mail opens the HTTPS bounce page.
 * `search` and `hash` should be `window.location.search` / `.hash` (including
 * their leading `?` / `#` when present). Tokens stay in the URL — never render them.
 */
export function buildNativeAppCallbackHref(search: string, hash: string) {
  return `${NATIVE_APP_CALLBACK_HREF}${search}${hash}`;
}
