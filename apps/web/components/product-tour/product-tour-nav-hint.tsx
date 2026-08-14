'use client';

import { useContext, useState, useTransition } from 'react';

import { X } from 'lucide-react';

import { SidebarContext } from '@kit/ui/shadcn-sidebar';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import {
  markProductTourCompletedAction,
  resetProductTourAction,
} from '~/lib/product-tour/product-tour.actions';

type ProductTourNavHintProps = {
  className?: string;
};

export function ProductTourNavHint({ className }: ProductTourNavHintProps) {
  const ctx = useContext(SidebarContext);
  const collapsed = ctx ? !ctx.open : false;
  const [hidden, setHidden] = useState(false);
  const [pending, startTransition] = useTransition();

  if (hidden || collapsed) return null;

  const dismiss = () => {
    setHidden(true);
    startTransition(async () => {
      try {
        await markProductTourCompletedAction({
          tourId: 'personal_nav_tour_hint',
        });
      } catch {
        // Keep hidden locally even if persist fails.
      }
    });
  };

  const startTour = () => {
    startTransition(async () => {
      try {
        await Promise.all([
          resetProductTourAction({ tourId: 'personal' }),
          markProductTourCompletedAction({
            tourId: 'personal_nav_tour_hint',
          }),
        ]);
        window.location.assign(pathsConfig.app.home);
      } catch {
        setHidden(false);
      }
    });
  };

  return (
    <div
      className={cn(
        'mb-2 flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-[var(--workspace-shell-text-muted)]',
        className,
      )}
      data-test="product-tour-nav-hint"
    >
      <button
        type="button"
        disabled={pending}
        onClick={startTour}
        className="min-w-0 flex-1 truncate text-left font-medium text-[var(--ozer-accent)] hover:underline disabled:opacity-60"
      >
        Take a quick tour
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={dismiss}
        aria-label="Dismiss tour hint"
        data-test="product-tour-nav-hint-dismiss"
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)] disabled:opacity-60"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
