import { describe, expect, it } from 'vitest';

import {
  MOBILE_FLOATING_CHROME_ABOVE,
  MOBILE_FLOATING_CHROME_PB,
  MOBILE_FLOATING_CHROME_SCROLL_PB,
  WORKSPACE_SHELL_PAGE_CLASS,
  WORKSPACE_SHELL_VIEWPORT_CLASS,
  WORKSPACE_VISUAL_VIEWPORT_H,
} from '~/lib/mobile-nav/mobile-floating-chrome';

describe('mobile floating chrome tokens', () => {
  it('pads the bar with safe-area only (8px floor, no 24px extra float)', () => {
    expect(MOBILE_FLOATING_CHROME_PB).toBe(
      'pb-[max(0.5rem,env(safe-area-inset-bottom))]',
    );
    expect(MOBILE_FLOATING_CHROME_PB).not.toContain('1.5rem');
  });

  it('keeps scroll and popover clearance on the same inset', () => {
    expect(MOBILE_FLOATING_CHROME_SCROLL_PB).toBe(
      'pb-[calc(4.75rem+max(0.5rem,env(safe-area-inset-bottom)))]',
    );
    expect(MOBILE_FLOATING_CHROME_ABOVE).toBe(
      'bottom-[calc(4.75rem+max(0.5rem,env(safe-area-inset-bottom))+0.5rem)]',
    );
  });

  it('sizes the team and personal shells from the visual-height variable', () => {
    expect(WORKSPACE_VISUAL_VIEWPORT_H).toBe(
      'h-[var(--workspace-visual-height,100dvh)] max-h-[var(--workspace-visual-height,100dvh)]',
    );
    expect(WORKSPACE_SHELL_VIEWPORT_CLASS).toContain(
      WORKSPACE_VISUAL_VIEWPORT_H,
    );
    expect(WORKSPACE_SHELL_PAGE_CLASS).toContain(WORKSPACE_VISUAL_VIEWPORT_H);
    expect(WORKSPACE_SHELL_VIEWPORT_CLASS).not.toContain('max-h-dvh');
    expect(WORKSPACE_SHELL_PAGE_CLASS).not.toContain('max-h-dvh');
  });
});
