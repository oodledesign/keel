import type { ReactNode } from 'react';

import { cn } from '@kit/ui/utils';

import {
  MOBILE_FLOATING_CHROME_SCROLL_PADDING,
  MOBILE_FLOATING_CHROME_SCROLL_PB,
} from '~/lib/mobile-nav/mobile-floating-chrome';

export const WORKSPACE_MOBILE_SCROLL_INNER_CLASS = [
  'min-h-0 flex-1 touch-manipulation overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]',
  MOBILE_FLOATING_CHROME_SCROLL_PADDING,
].join(' ');

/**
 * Fill the scrollport so `flex-1 min-h-0 overflow-hidden` pages (boards)
 * get a real height and can own vertical scroll. `h-full min-h-full`
 * together means a viewport-height floor that can still grow for tall
 * pages; those overflow this box and the outer scroller handles them.
 */
export const WORKSPACE_MOBILE_SCROLL_FILL_CLASS =
  'flex h-full min-h-full min-w-0 flex-col bg-[var(--workspace-shell-canvas)]';

export const WORKSPACE_MOBILE_SCROLL_PAGE_CLASS = cn(
  MOBILE_FLOATING_CHROME_SCROLL_PB,
  'flex min-h-0 flex-1 flex-col lg:pb-0',
);

type WorkspaceMobileScrollAreaProps = {
  children: ReactNode;
  className?: string;
};

/** Inner scroll container used by PullToRefresh and dashboard routes without PTR. */
export function WorkspaceMobileScrollArea({
  children,
  className,
}: WorkspaceMobileScrollAreaProps) {
  return (
    <div
      className={cn(
        'relative flex min-h-0 flex-1 flex-col bg-[var(--workspace-shell-header)] lg:bg-transparent',
        className,
      )}
    >
      <div
        data-workspace-mobile-scroll-inner
        className={WORKSPACE_MOBILE_SCROLL_INNER_CLASS}
      >
        <div className={WORKSPACE_MOBILE_SCROLL_FILL_CLASS}>
          <div className={WORKSPACE_MOBILE_SCROLL_PAGE_CLASS}>{children}</div>
        </div>
      </div>
    </div>
  );
}
