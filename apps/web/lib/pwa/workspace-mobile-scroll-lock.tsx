'use client';

import { useEffect } from 'react';

import { usePathname } from 'next/navigation';

import { isNoteEditorRoute } from '~/lib/pwa/is-note-editor-route';
import { isMobileViewport } from '~/lib/pwa/pull-to-refresh-context';

/**
 * Keeps mobile workspace routes on a single inner scroll container (PullToRefresh).
 * Without this, overscroll can chain to the document and the whole shell — including
 * the mobile header — scrolls away.
 */
export function WorkspaceMobileScrollLock() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!isMobileViewport()) {
      return;
    }

    if (isNoteEditorRoute(pathname)) {
      return;
    }

    const html = document.documentElement;
    const body = document.body;

    const previous = {
      htmlOverflow: html.style.overflow,
      htmlHeight: html.style.height,
      bodyOverflow: body.style.overflow,
      bodyHeight: body.style.height,
    };

    html.style.overflow = 'hidden';
    html.style.height = '100%';
    body.style.overflow = 'hidden';
    body.style.height = '100%';

    if (window.scrollY > 0) {
      window.scrollTo(0, 0);
    }

    return () => {
      html.style.overflow = previous.htmlOverflow;
      html.style.height = previous.htmlHeight;
      body.style.overflow = previous.bodyOverflow;
      body.style.height = previous.bodyHeight;
    };
  }, [pathname]);

  return null;
}
