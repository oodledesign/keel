'use client';

import { useEffect } from 'react';

const VIEWPORT_SELECTOR = '[data-team-workspace-viewport]';
const SHELL_SELECTOR = '[data-team-workspace-shell]';
const PAGE_SELECTOR = '[data-team-workspace-page]';

/**
 * On note editor routes the workspace shell uses a fixed viewport with inner
 * scroll containers. This unlocks document-level scrolling so pull-to-refresh
 * and nested scroll traps do not fight the textarea.
 */
export function NoteEditorScrollShell({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const viewport = document.querySelector(
      VIEWPORT_SELECTOR,
    ) as HTMLElement | null;
    const shell = document.querySelector(SHELL_SELECTOR) as HTMLElement | null;
    const page = document.querySelector(PAGE_SELECTOR) as HTMLElement | null;
    const html = document.documentElement;
    const body = document.body;

    const previous = {
      viewportHeight: viewport?.style.height ?? '',
      viewportMinHeight: viewport?.style.minHeight ?? '',
      viewportOverflow: viewport?.style.overflow ?? '',
      shellOverflow: shell?.style.overflow ?? '',
      shellMinHeight: shell?.style.minHeight ?? '',
      shellHeight: shell?.style.height ?? '',
      pageHeight: page?.style.height ?? '',
      pageMinHeight: page?.style.minHeight ?? '',
      pageOverflow: page?.style.overflow ?? '',
      htmlOverscroll: html.style.overscrollBehaviorY,
      bodyOverscroll: body.style.overscrollBehaviorY,
      bodyOverflow: body.style.overflowY,
    };

    if (viewport) {
      viewport.style.height = 'auto';
      viewport.style.minHeight = '100svh';
      viewport.style.overflow = 'visible';
    }

    if (shell) {
      shell.style.overflow = 'visible';
      shell.style.minHeight = '0';
      shell.style.height = 'auto';
    }

    if (page) {
      page.style.height = 'auto';
      page.style.minHeight = '100svh';
      page.style.overflow = 'visible';
    }

    html.style.overscrollBehaviorY = 'none';
    body.style.overscrollBehaviorY = 'none';
    body.style.overflowY = 'auto';

    return () => {
      if (viewport) {
        viewport.style.height = previous.viewportHeight;
        viewport.style.minHeight = previous.viewportMinHeight;
        viewport.style.overflow = previous.viewportOverflow;
      }

      if (shell) {
        shell.style.overflow = previous.shellOverflow;
        shell.style.minHeight = previous.shellMinHeight;
        shell.style.height = previous.shellHeight;
      }

      if (page) {
        page.style.height = previous.pageHeight;
        page.style.minHeight = previous.pageMinHeight;
        page.style.overflow = previous.pageOverflow;
      }

      html.style.overscrollBehaviorY = previous.htmlOverscroll;
      body.style.overscrollBehaviorY = previous.bodyOverscroll;
      body.style.overflowY = previous.bodyOverflow;
    };
  }, []);

  return children;
}
