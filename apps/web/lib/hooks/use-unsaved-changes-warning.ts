'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_MESSAGE =
  'You have unsaved changes. Are you sure you want to leave this page?';

function stableSerialize(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Tracks whether the current form fingerprint differs from the last clean
 * snapshot (initial load or after a successful save).
 */
export function useFormDirtyState(
  fingerprint: unknown,
  options?: { enabled?: boolean },
): { isDirty: boolean; markClean: () => void } {
  const enabled = options?.enabled ?? true;
  const serialized = useMemo(() => stableSerialize(fingerprint), [fingerprint]);
  const [baseline, setBaseline] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setBaseline(null);
      return;
    }
    setBaseline((current) => (current === null ? serialized : current));
  }, [enabled, serialized]);

  const markClean = useCallback(() => {
    setBaseline(serialized);
  }, [serialized]);

  const isDirty = Boolean(
    enabled && baseline !== null && serialized !== baseline,
  );

  return { isDirty, markClean };
}

/**
 * Warns before leaving the page when there are unsaved changes:
 * - browser refresh / tab close (`beforeunload`)
 * - in-app link clicks (sidebar, back links, etc.)
 */
export function useUnsavedChangesWarning(
  isDirty: boolean,
  options?: { message?: string },
) {
  const message = options?.message ?? DEFAULT_MESSAGE;
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;

  useEffect(() => {
    if (!isDirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;

    const onDocumentClick = (event: MouseEvent) => {
      if (!dirtyRef.current) return;
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:')) return;
      if (href.startsWith('tel:') || href.startsWith('javascript:')) return;

      let nextUrl: URL;
      try {
        nextUrl = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (nextUrl.origin !== window.location.origin) return;
      if (
        nextUrl.pathname === window.location.pathname &&
        nextUrl.search === window.location.search &&
        nextUrl.hash === window.location.hash
      ) {
        return;
      }

      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener('click', onDocumentClick, true);
    return () => document.removeEventListener('click', onDocumentClick, true);
  }, [isDirty, message]);
}
