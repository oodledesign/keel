/** CSS custom property synced to the visible window on mobile workspace routes. */
export const WORKSPACE_VISUAL_HEIGHT_VAR = '--workspace-visual-height';

/**
 * Largest `screen.height - visualViewport` shortfall treated as the iOS
 * safe-area lie (top inset, or top plus home indicator) rather than a
 * visible Safari toolbar or the keyboard.
 */
export const WORKSPACE_VIEWPORT_LIE_MAX_PX = 96;

/** Visual viewport this far below the screen is the keyboard, not the safe-area lie. */
export const WORKSPACE_KEYBOARD_HEIGHT_GAP_PX = 120;

/**
 * Pixel height reported by layout/visual viewport APIs.
 *
 * iOS Safari/Chrome often report a short `dvh` / visual viewport while
 * `window.innerHeight` still covers the on-screen canvas. Use the larger
 * value. Installed PWAs lie on both — see `resolveWorkspaceVisualHeightCss`.
 */
export function resolveWorkspaceVisualHeightPx(
  innerHeight: number,
  visualViewport?: Pick<VisualViewport, 'height' | 'offsetTop'> | null,
): number {
  if (!visualViewport) {
    return innerHeight;
  }

  const visualBottom = visualViewport.height + visualViewport.offsetTop;

  return Math.max(innerHeight, Math.round(visualBottom));
}

export type WorkspaceVisualHeightInput = {
  innerHeight: number;
  visualViewport?: Pick<VisualViewport, 'height' | 'offsetTop'> | null;
  /** `window.screen.height` in CSS pixels. Physical-pixel values are ignored. */
  screenHeight?: number | null;
  /** Add to Home Screen / installed PWA. `100vh` is the full screen there. */
  standalone?: boolean;
  /** iOS Safari or standalone. Android keeps the reported visual height. */
  ios?: boolean;
};

/**
 * CSS height for the workspace shell and the document on mobile.
 *
 * In an installed iOS PWA with `viewport-fit=cover`, `100dvh`, `innerHeight`,
 * and `visualViewport.height` are short by `safe-area-inset-top`. Locking the
 * shell to that number leaves a theme-color band under the floating nav.
 * `100vh` still equals the screen because there is no browser toolbar.
 *
 * Mobile Safari keeps the reported height when the toolbar is open so the nav
 * is not pushed behind it. A shortfall of only the safe-area size (toolbar
 * hidden, or the same PWA lie) uses `100vh` instead.
 *
 * Returns a length the shell can assign directly (`100vh` or `Npx`).
 */
export function resolveWorkspaceVisualHeightCss(
  input: WorkspaceVisualHeightInput,
): string {
  const visualBottom = input.visualViewport
    ? input.visualViewport.height + input.visualViewport.offsetTop
    : input.innerHeight;
  const reported = resolveWorkspaceVisualHeightPx(
    input.innerHeight,
    input.visualViewport,
  );
  const screenHeight = usableScreenHeight(
    input.screenHeight,
    input.innerHeight,
    visualBottom,
  );
  const uncovered = screenHeight > 0 ? screenHeight - visualBottom : 0;

  if (
    input.standalone &&
    screenHeight > 0 &&
    uncovered > WORKSPACE_KEYBOARD_HEIGHT_GAP_PX
  ) {
    return `${Math.round(visualBottom)}px`;
  }

  if (input.standalone) {
    return '100vh';
  }

  if (
    input.ios &&
    uncovered > 1 &&
    uncovered <= WORKSPACE_VIEWPORT_LIE_MAX_PX
  ) {
    return '100vh';
  }

  return `${reported}px`;
}

function usableScreenHeight(
  screenHeight: number | null | undefined,
  innerHeight: number,
  visualBottom: number,
): number {
  if (
    screenHeight == null ||
    !Number.isFinite(screenHeight) ||
    screenHeight <= 0
  ) {
    return 0;
  }

  const basis = Math.max(innerHeight, visualBottom, 1);

  // A 2x/3x `screen.height` is device pixels and cannot be compared to CSS px.
  if (screenHeight > basis * 1.5) {
    return 0;
  }

  return screenHeight;
}
