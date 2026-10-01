'use client';

import { useEffect } from 'react';

const LOCK = 'maximum-scale=1, user-scalable=no';

/**
 * Stops the page zooming (pinch, double-tap and the iOS zoom-on-focus) while
 * `active`. A zoomed page pushes a fixed drawer's controls off-screen, where
 * they can't be reached. The viewport is restored on cleanup.
 */
export function useLockPageZoom(active = true) {
  useEffect(() => {
    if (!active) return;

    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="viewport"]',
    );
    const original = meta?.getAttribute('content') ?? null;
    const locked =
      original && !original.includes('maximum-scale')
        ? `${original}, ${LOCK}`
        : null;
    if (meta && locked) meta.setAttribute('content', locked);

    // Safari reports pinch gestures separately from touch events.
    const block = (event: Event) => event.preventDefault();
    document.addEventListener('gesturestart', block, { passive: false });
    document.addEventListener('gesturechange', block, { passive: false });

    return () => {
      document.removeEventListener('gesturestart', block);
      document.removeEventListener('gesturechange', block);
      if (meta && locked && meta.getAttribute('content') === locked) {
        meta.setAttribute('content', original!);
      }
    };
  }, [active]);
}
