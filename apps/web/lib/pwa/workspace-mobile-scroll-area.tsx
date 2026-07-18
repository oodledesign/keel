import type { ReactNode } from 'react';

import { cn } from '@kit/ui/utils';

import { MOBILE_FLOATING_CHROME_SCROLL_PB } from '~/lib/mobile-nav/mobile-floating-chrome';

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
      <div className="min-h-0 flex-1 touch-manipulation overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
        <div className="min-h-full bg-[var(--workspace-shell-canvas)]">
          <div className={cn(MOBILE_FLOATING_CHROME_SCROLL_PB, 'lg:pb-0')}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
