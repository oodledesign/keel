/** Shared layout tokens for the mobile floating bottom chrome row. */

export const MOBILE_FLOATING_CHROME_PX = 'px-3';

export const MOBILE_FLOATING_CHROME_PB =
  'pb-[max(0.5rem,env(safe-area-inset-bottom))]';

/** Scrollable content padding to clear the floating bottom bar. */
export const MOBILE_FLOATING_CHROME_SCROLL_PB =
  'pb-[calc(3rem+max(0.5rem,env(safe-area-inset-bottom)))]';

/** Popovers anchored above the floating bottom bar. */
export const MOBILE_FLOATING_CHROME_ABOVE =
  'bottom-[calc(3rem+max(0.5rem,env(safe-area-inset-bottom))+0.5rem)]';
