'use client';

import { useLayoutEffect } from 'react';

import { usePathname } from 'next/navigation';

import { isNoteEditorRoute } from '~/lib/pwa/is-note-editor-route';
import { isIosWebKit, isStandalonePwa } from '~/lib/pwa/is-standalone-pwa';
import { isMobileViewport } from '~/lib/pwa/pull-to-refresh-context';
import {
  WORKSPACE_VISUAL_HEIGHT_VAR,
  resolveWorkspaceVisualHeightCss,
} from '~/lib/pwa/workspace-visual-height';

/**
 * Keeps mobile workspace routes on a single inner scroll container (PullToRefresh).
 * Without this, overscroll can chain to the document and the whole shell — including
 * the mobile header — scrolls away.
 *
 * Also publishes `--workspace-visual-height` so the shell fills the on-screen
 * window. iOS standalone under-reports `100dvh` / `innerHeight` by the top
 * safe area; locking the shell to that short box leaves a dead band under the
 * floating nav. `100vh` is the full screen in standalone (no browser toolbar).
 */
export function WorkspaceMobileScrollLock() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    if (!isMobileViewport()) {
      return;
    }

    const noteEditor = isNoteEditorRoute(pathname);
    const html = document.documentElement;
    const body = document.body;

    const previous = {
      htmlOverflow: html.style.overflow,
      htmlHeight: html.style.height,
      htmlMinHeight: html.style.minHeight,
      htmlVisualHeight:
        html.style.getPropertyValue(WORKSPACE_VISUAL_HEIGHT_VAR) || null,
      bodyOverflow: body.style.overflow,
      bodyHeight: body.style.height,
      bodyMinHeight: body.style.minHeight,
    };

    const apply = () => {
      const cssHeight = resolveWorkspaceVisualHeightCss({
        innerHeight: window.innerHeight,
        visualViewport: window.visualViewport,
        screenHeight: window.screen?.height,
        standalone: isStandalonePwa(),
        ios: isIosWebKit(),
      });

      html.style.setProperty(WORKSPACE_VISUAL_HEIGHT_VAR, cssHeight);
      // Override `min-h-dvh` on <html>. Otherwise a short toolbar height loses
      // to the dynamic viewport and the cream page background shows underneath.
      html.style.height = cssHeight;
      html.style.minHeight = cssHeight;
      body.style.height = cssHeight;
      body.style.minHeight = cssHeight;

      // Note editor owns document scroll. Still size the shell to the real
      // viewport so it is not capped to the short iOS `dvh` box.
      if (noteEditor) {
        return;
      }

      html.style.overflow = 'hidden';
      body.style.overflow = 'hidden';
    };

    let raf: number | undefined;
    const applyRaf = () => {
      if (raf !== undefined) {
        window.cancelAnimationFrame(raf);
      }
      raf = window.requestAnimationFrame(() => {
        apply();
        raf = undefined;
      });
    };

    apply();

    if (window.scrollY > 0) {
      window.scrollTo(0, 0);
    }

    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener('resize', applyRaf);
    visualViewport?.addEventListener('scroll', applyRaf);
    window.addEventListener('resize', applyRaf);

    return () => {
      if (raf !== undefined) {
        window.cancelAnimationFrame(raf);
      }
      visualViewport?.removeEventListener('resize', applyRaf);
      visualViewport?.removeEventListener('scroll', applyRaf);
      window.removeEventListener('resize', applyRaf);
      html.style.overflow = previous.htmlOverflow;
      html.style.height = previous.htmlHeight;
      html.style.minHeight = previous.htmlMinHeight;
      if (previous.htmlVisualHeight !== null) {
        html.style.setProperty(
          WORKSPACE_VISUAL_HEIGHT_VAR,
          previous.htmlVisualHeight,
        );
      } else {
        html.style.removeProperty(WORKSPACE_VISUAL_HEIGHT_VAR);
      }
      body.style.overflow = previous.bodyOverflow;
      body.style.height = previous.bodyHeight;
      body.style.minHeight = previous.bodyMinHeight;
    };
  }, [pathname]);

  return null;
}
