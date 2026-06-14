import { isStandalonePwa } from './is-standalone-pwa';
import { isNoteEditorRoute } from './is-note-editor-route';

const MOBILE_MAX_WIDTH = 1023;

let currentPathname =
  typeof window !== 'undefined' ? window.location.pathname : '';

const pathnameListeners = new Set<() => void>();

/** Keep pull-to-refresh in sync with client navigations. */
export function syncPullToRefreshPathname(pathname: string) {
  if (currentPathname === pathname) {
    return;
  }

  currentPathname = pathname;
  pathnameListeners.forEach((listener) => listener());
}

/** Matches Tailwind `lg` — same breakpoint as the mobile workspace shell. */
export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches;
}

function hasTouchInput(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/** PWA install or mobile browser with touch (Safari, Chrome, etc.). */
export function isPullToRefreshEnabled(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  if (isNoteEditorRoute(currentPathname)) {
    return false;
  }

  return isStandalonePwa() || (isMobileViewport() && hasTouchInput());
}

export function subscribePullToRefreshContext(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const mq = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`);
  mq.addEventListener('change', onStoreChange);
  pathnameListeners.add(onStoreChange);

  return () => {
    mq.removeEventListener('change', onStoreChange);
    pathnameListeners.delete(onStoreChange);
  };
}
