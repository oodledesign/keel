'use client';

import { useEffect } from 'react';

import { Heading } from '@kit/ui/heading';
import { Trans } from '@kit/ui/trans';

import { buildNativeAppCallbackHref } from '../_lib/native-app-callback-url';

/**
 * App-only hop. Immediately replace with the custom scheme so Mail on iPhone
 * can open Ozer. Desktop (or a failed hop) keeps this fallback copy — no
 * tokens, no browser-login CTA.
 */
export function NativeAuthBounce() {
  useEffect(() => {
    window.location.replace(
      buildNativeAppCallbackHref(window.location.search, window.location.hash),
    );
  }, []);

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <Heading
        level={4}
        className="tracking-tight text-[var(--workspace-shell-text)]"
      >
        <Trans i18nKey="auth:nativeAuthHeading" />
      </Heading>

      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
        <Trans i18nKey="auth:nativeAuthBody" />
      </p>

      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
        <Trans i18nKey="auth:nativeAuthHint" />
      </p>
    </div>
  );
}
