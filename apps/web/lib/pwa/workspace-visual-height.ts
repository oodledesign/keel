/** CSS custom property synced to the visible window on mobile workspace routes. */
export const WORKSPACE_VISUAL_HEIGHT_VAR = '--workspace-visual-height';

/**
 * Pixel height the workspace shell should fill.
 *
 * iOS Safari/Chrome often report a short `dvh` / visual viewport while
 * `window.innerHeight` still covers the on-screen canvas. A `max-h-dvh`
 * shell then sits above a dead band, and `position:fixed; bottom:0` (contained
 * by that overflow box) sits with it. Use the larger value so the shell
 * reaches the visual bottom.
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
