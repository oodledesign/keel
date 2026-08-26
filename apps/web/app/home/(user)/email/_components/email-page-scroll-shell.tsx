'use client';

import { useEffect } from 'react';

const SCROLL_INNER = '[data-workspace-mobile-scroll-inner]';

/**
 * Email uses a split inbox + thread layout with inner scroll regions. Disable
 * the workspace shell's outer scroll on desktop so the inbox column stays put.
 */
export function EmailPageScrollShell({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const scrollEl = document.querySelector(
      SCROLL_INNER,
    ) as HTMLElement | null;

    if (!scrollEl) {
      return;
    }

    const canvas = scrollEl.querySelector(
      ':scope > div > div',
    ) as HTMLElement | null;

    const mq = window.matchMedia('(min-width: 1024px)');

    const apply = () => {
      if (mq.matches) {
        scrollEl.style.overflow = 'hidden';
        scrollEl.style.display = 'flex';
        scrollEl.style.flexDirection = 'column';
        if (canvas) {
          canvas.style.minHeight = '100%';
          canvas.style.height = '100%';
          canvas.style.display = 'flex';
          canvas.style.flexDirection = 'column';
        }
        return;
      }

      scrollEl.style.overflow = '';
      scrollEl.style.display = '';
      scrollEl.style.flexDirection = '';
      if (canvas) {
        canvas.style.minHeight = '';
        canvas.style.height = '';
        canvas.style.display = '';
        canvas.style.flexDirection = '';
      }
    };

    apply();
    mq.addEventListener('change', apply);

    return () => {
      mq.removeEventListener('change', apply);
      scrollEl.style.overflow = '';
      scrollEl.style.display = '';
      scrollEl.style.flexDirection = '';
      if (canvas) {
        canvas.style.minHeight = '';
        canvas.style.height = '';
        canvas.style.display = '';
        canvas.style.flexDirection = '';
      }
    };
  }, []);

  return children;
}
