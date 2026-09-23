/** iPhone, iPod, iPad, and iPadOS (which reports as Mac with touch). */
export function isIosWebKit(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const ua = navigator.userAgent || '';

  if (/iPad|iPhone|iPod/.test(ua)) {
    return true;
  }

  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

/** True when the app is running installed (Add to Home Screen / PWA). */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const nav = window.navigator as Navigator & { standalone?: boolean };

  return (
    nav.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches
  );
}
