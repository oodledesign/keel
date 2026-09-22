'use client';

import { flushSync } from 'react-dom';

/**
 * Paint a local update before a server action starts.
 * Next.js wraps server-action calls in a transition, so a plain setState in
 * the same event can wait until the round-trip finishes.
 */
export function commitOptimisticUpdate(update: () => void) {
  flushSync(update);
}
