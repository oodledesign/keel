import { describe, expect, it } from 'vitest';

import {
  NATIVE_APP_CALLBACK_HREF,
  buildNativeAppCallbackHref,
} from './native-app-callback-url';

describe('buildNativeAppCallbackHref', () => {
  it('hops to the custom scheme with no query or hash', () => {
    expect(buildNativeAppCallbackHref('', '')).toBe(NATIVE_APP_CALLBACK_HREF);
  });

  it('forwards the Supabase query and hash fragment', () => {
    expect(
      buildNativeAppCallbackHref('?code=pkce-code', '#type=magiclink'),
    ).toBe(`${NATIVE_APP_CALLBACK_HREF}?code=pkce-code#type=magiclink`);
  });
});
