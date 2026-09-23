/** Shared layout tokens for the mobile floating bottom chrome row. */

export const MOBILE_FLOATING_CHROME_PX = 'px-3';

/**
 * Sit on the visual bottom. Pad only the home indicator (or 8px when the
 * inset is 0) — do not add a 24px Instagram float on top of safe-area.
 * A larger min was stacking with iOS browser chrome / a short dvh shell
 * and showed up as a dead white band under the bar.
 */
export const MOBILE_FLOATING_CHROME_PB =
  'pb-[max(0.5rem,env(safe-area-inset-bottom))]';

/** Scrollable content padding to clear the floating bottom bar + home indicator. */
export const MOBILE_FLOATING_CHROME_SCROLL_PB =
  'pb-[calc(4.75rem+max(0.5rem,env(safe-area-inset-bottom)))]';

/** Same clearance for keyboard focus scrolling inside the page scroller. */
export const MOBILE_FLOATING_CHROME_SCROLL_PADDING =
  'scroll-pb-[calc(4.75rem+max(0.5rem,env(safe-area-inset-bottom)))] lg:scroll-pb-0';

/** Popovers anchored above the floating bottom bar. */
export const MOBILE_FLOATING_CHROME_ABOVE =
  'bottom-[calc(4.75rem+max(0.5rem,env(safe-area-inset-bottom))+0.5rem)]';

/**
 * Authenticated workspace viewport height. Mobile scroll-lock sets
 * `--workspace-visual-height` to the on-screen window (`100vh` in an
 * installed PWA, where `100dvh` / `innerHeight` omit the top safe area).
 * A short box leaves a dead band under the floating nav.
 */
export const WORKSPACE_VISUAL_VIEWPORT_H =
  'h-[var(--workspace-visual-height,100dvh)] max-h-[var(--workspace-visual-height,100dvh)]';

export const WORKSPACE_SHELL_VIEWPORT_CLASS = [
  'mx-auto flex',
  WORKSPACE_VISUAL_VIEWPORT_H,
  'min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-[var(--workspace-shell-canvas)]',
].join(' ');

export const WORKSPACE_SHELL_PAGE_CLASS = [
  'flex',
  WORKSPACE_VISUAL_VIEWPORT_H,
  'min-h-0 flex-1 flex-col',
].join(' ');
