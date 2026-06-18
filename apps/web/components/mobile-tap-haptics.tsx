'use client';

import { useEffect } from 'react';

import { triggerHapticFeedback } from '~/lib/haptics';

/**
 * Light haptic tap on interactive elements for touch devices (iOS Safari, Android).
 * Mounted once in mobile chrome layouts.
 */
export function MobileTapHaptics() {
  useEffect(() => {
    const coarsePointer = window.matchMedia('(hover: none) and (pointer: coarse)');
    if (!coarsePointer.matches) return;

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const interactive = target.closest(
        'button, a[href], [role="button"], input[type="submit"], input[type="button"]',
      );
      if (!interactive || interactive.closest('[data-no-haptic]')) return;

      triggerHapticFeedback();
    };

    document.addEventListener('pointerup', onPointerUp, { capture: true });
    return () => document.removeEventListener('pointerup', onPointerUp, { capture: true });
  }, []);

  return null;
}
