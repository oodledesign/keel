/** Max size for centered modals — keeps panels inside the viewport on mobile. */
export const modalViewportClass =
  'max-h-[min(90dvh,calc(100dvh-2rem))] w-[calc(100%-2rem)] max-w-[calc(100vw-2rem)] sm:w-full sm:max-w-lg';

/** Scrollable centered modal body. */
export const modalScrollClass = `${modalViewportClass} overflow-y-auto overscroll-contain`;

/** Radix popover surfaces — respect collision padding from the trigger. */
export const popoverViewportClass =
  'max-h-[var(--radix-popover-content-available-height)] overflow-y-auto overscroll-contain';

/** Radix dropdown surfaces. */
export const dropdownViewportClass =
  'max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto overscroll-contain';

/** Radix select list — cap height on small screens. */
export const selectViewportClass =
  'max-h-[min(24rem,var(--radix-select-content-available-height))]';

/** Sheet / drawer panels. */
export const sheetScrollClass =
  'overflow-y-auto overscroll-contain max-h-[100dvh]';
