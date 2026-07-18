'use client';

import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { useRouter } from 'next/navigation';

import { Loader2 } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import { triggerHapticFeedback } from '~/lib/haptics';
import { MOBILE_FLOATING_CHROME_SCROLL_PB } from '~/lib/mobile-nav/mobile-floating-chrome';
import {
  isPullToRefreshEnabled,
  subscribePullToRefreshContext,
} from '~/lib/pwa/pull-to-refresh-context';
import { WorkspaceMobileScrollArea } from '~/lib/pwa/workspace-mobile-scroll-area';
import { scrollWheelDeltaToScrollParent } from '~/lib/scroll-passthrough';

const PULL_THRESHOLD = 72;
const MAX_PULL = 112;
const REFRESH_HOLD = 48;
const REFRESH_COOLDOWN_MS = 5000;

/** Survives PullToRefresh remounts during layout Suspense/refresh cycles. */
let lastGlobalRefreshAt = 0;
let globalRefreshInFlight = false;

type PullToRefreshProps = {
  children: ReactNode;
  className?: string;
};

export function PullToRefresh({ children, className }: PullToRefreshProps) {
  const router = useRouter();
  const enabled = useSyncExternalStore(
    subscribePullToRefreshContext,
    isPullToRefreshEnabled,
    () => false,
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const refreshingRef = useRef(false);

  const [pullDistance, setPullDistanceState] = useState(0);
  const [refreshing, setRefreshingState] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const setPullDistance = useCallback((value: number) => {
    pullDistanceRef.current = value;
    setPullDistanceState(value);
  }, []);

  const setRefreshing = useCallback((value: boolean) => {
    refreshingRef.current = value;
    setRefreshingState(value);
  }, []);

  const getScrollTop = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return 0;
    return el.scrollTop;
  }, []);

  const contentOffset = refreshing ? REFRESH_HOLD : pullDistance;

  const handleRefresh = useCallback(() => {
    if (refreshingRef.current || globalRefreshInFlight) return;

    const now = Date.now();
    if (now - lastGlobalRefreshAt < REFRESH_COOLDOWN_MS) {
      setPullDistance(0);
      return;
    }

    lastGlobalRefreshAt = now;
    globalRefreshInFlight = true;
    setRefreshing(true);
    setPullDistance(REFRESH_HOLD);
    triggerHapticFeedback(10);
    router.refresh();

    window.setTimeout(() => {
      globalRefreshInFlight = false;
      setRefreshing(false);
      setPullDistance(0);
    }, 700);
  }, [router, setPullDistance, setRefreshing]);

  const onTouchStart = useCallback(
    (event: TouchEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.closest('textarea, input, select, [contenteditable="true"]') ||
          target.closest('[data-horizontal-scroll]'))
      ) {
        pullingRef.current = false;
        return;
      }

      if (!enabled || refreshingRef.current || getScrollTop() > 0) {
        pullingRef.current = false;
        return;
      }

      startXRef.current = event.touches[0]?.clientX ?? 0;
      startYRef.current = event.touches[0]?.clientY ?? 0;
      pullingRef.current = true;
      setIsDragging(true);
    },
    [enabled, getScrollTop],
  );

  const onTouchMove = useCallback(
    (event: TouchEvent) => {
      if (!pullingRef.current || refreshingRef.current) return;

      if (getScrollTop() > 0) {
        pullingRef.current = false;
        setIsDragging(false);
        setPullDistance(0);
        return;
      }

      const currentX = event.touches[0]?.clientX ?? 0;
      const currentY = event.touches[0]?.clientY ?? 0;
      const deltaX = currentX - startXRef.current;
      const delta = currentY - startYRef.current;

      // Let horizontal carousels (e.g. recent notes) own sideways gestures.
      if (Math.abs(deltaX) > Math.abs(delta) && Math.abs(deltaX) > 8) {
        pullingRef.current = false;
        setIsDragging(false);
        setPullDistance(0);
        return;
      }

      if (delta <= 0) {
        setPullDistance(0);
        return;
      }

      event.preventDefault();
      setPullDistance(Math.min(delta * 0.55, MAX_PULL));
    },
    [getScrollTop, setPullDistance],
  );

  const onTouchEnd = useCallback(() => {
    if (!pullingRef.current) return;

    pullingRef.current = false;
    setIsDragging(false);

    if (pullDistanceRef.current >= PULL_THRESHOLD) {
      handleRefresh();
      return;
    }

    setPullDistance(0);
  }, [handleRefresh, setPullDistance]);

  useEffect(() => {
    if (!enabled) return;

    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [enabled, onTouchEnd, onTouchMove, onTouchStart]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const onWheel = (event: WheelEvent) => {
      const target = event.target;

      if (
        !(
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLInputElement
        )
      ) {
        return;
      }

      scrollWheelDeltaToScrollParent(target, event);
    };

    scrollEl.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      scrollEl.removeEventListener('wheel', onWheel);
    };
  }, []);

  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const showSpinner = enabled && (pullDistance > 8 || refreshing);

  if (!enabled) {
    return (
      <WorkspaceMobileScrollArea className={className}>
        {children}
      </WorkspaceMobileScrollArea>
    );
  }

  return (
    <div
      className={cn(
        'relative flex min-h-0 flex-1 flex-col bg-[var(--workspace-shell-header)] lg:bg-transparent',
        className,
      )}
    >
      <div
        aria-hidden
        aria-live="polite"
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 z-10 flex items-end justify-center pb-2',
          showSpinner ? 'opacity-100' : 'opacity-0',
        )}
        style={{ height: contentOffset }}
      >
        <Loader2
          className={cn(
            'h-5 w-5 text-[var(--workspace-shell-text-muted)]',
            refreshing ? 'animate-spin' : '',
          )}
          style={
            refreshing
              ? undefined
              : { transform: `rotate(${progress * 180}deg)` }
          }
        />
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 touch-manipulation overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]"
      >
        <div
          className={cn(
            'rounded-t-[1.25rem] bg-[var(--workspace-shell-canvas)] shadow-[0_-1px_0_rgba(255,255,255,0.06)]',
            !isDragging && pullDistance === 0 && !refreshing
              ? ''
              : !isDragging && 'transition-transform duration-200 ease-out',
          )}
          style={
            contentOffset > 0
              ? { transform: `translateY(${contentOffset}px)` }
              : undefined
          }
        >
          <div className={cn(MOBILE_FLOATING_CHROME_SCROLL_PB, 'lg:pb-0')}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
