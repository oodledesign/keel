'use client';

import { useEffect } from 'react';

import { usePathname } from 'next/navigation';

import { isNoteEditorRoute } from '~/lib/pwa/is-note-editor-route';
import { isMobileViewport } from '~/lib/pwa/pull-to-refresh-context';
import {
  WORKSPACE_VISUAL_HEIGHT_VAR,
  resolveWorkspaceVisualHeightPx,
} from '~/lib/pwa/workspace-visual-height';

/**
 * Keeps mobile workspace routes on a single inner scroll container (PullToRefresh).
 * Without this, overscroll can chain to the document and the whole shell — including
 * the mobile header — scrolls away.
 *
 * Also publishes `--workspace-visual-height` so the shell fills the on-screen
 * window. A short `100dvh` box on iOS leaves a dead band under the floating nav.
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
      htmlVisualHeight: html.style.getPropertyValue(WORKSPACE_VISUAL_HEIGHT_VAR),
      bodyOverflow: body.style.overflow,
      bodyHeight: body.style.height,
    };

    const apply = () => {
      const heightPx = `${resolveWorkspaceVisualHeightPx(
        window.innerHeight,
        window.visualViewport,
      )}px`;

      html.style.overflow = 'hidden';
      html.style.height = heightPx;
      html.style.setProperty(WORKSPACE_VISUAL_HEIGHT_VAR, heightPx);
      body.style.overflow = 'hidden';
      body.style.height = heightPx;
    };

    apply();

    if (window.scrollY > 0) {
      window.scrollTo(0, 0);
    }

    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener('resize', apply);
    visualViewport?.addEventListener('scroll', apply);
    window.addEventListener('resize', apply);

    return () => {
      visualViewport?.removeEventListener('resize', apply);
      visualViewport?.removeEventListener('scroll', apply);
      window.removeEventListener('resize', apply);
      html.style.overflow = previous.htmlOverflow;
      html.style.height = previous.htmlHeight;
      if (previous.htmlVisualHeight) {
        html.style.setProperty(
          WORKSPACE_VISUAL_HEIGHT_VAR,
          previous.htmlVisualHeight,
        );
      } else {
        html.style.removeProperty(WORKSPACE_VISUAL_HEIGHT_VAR);
      }
      body.style.overflow = previous.bodyOverflow;
      body.style.height = previous.bodyHeight;
    };
  }, [pathname]);

  return null;
}
