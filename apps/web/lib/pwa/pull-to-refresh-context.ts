import { isStandalonePwa } from './is-standalone-pwa';

const MOBILE_MAX_WIDTH = 1023;

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

  return isStandalonePwa() || (isMobileViewport() && hasTouchInput());
}

export function subscribePullToRefreshContext(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const mq = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`);
  mq.addEventListener('change', onStoreChange);

  return () => mq.removeEventListener('change', onStoreChange);
}
