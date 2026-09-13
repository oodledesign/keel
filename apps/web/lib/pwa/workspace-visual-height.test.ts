import { describe, expect, it } from 'vitest';

import { resolveWorkspaceVisualHeightPx } from '~/lib/pwa/workspace-visual-height';

describe('resolveWorkspaceVisualHeightPx', () => {
  it('uses innerHeight when visualViewport is missing', () => {
    expect(resolveWorkspaceVisualHeightPx(800)).toBe(800);
    expect(resolveWorkspaceVisualHeightPx(800, null)).toBe(800);
  });

  it('fills a short visual viewport so the shell cannot leave a dead band', () => {
    expect(
      resolveWorkspaceVisualHeightPx(844, { height: 720, offsetTop: 0 }),
    ).toBe(844);
  });

  it('grows to the visual viewport bottom when that is taller than innerHeight', () => {
    expect(
      resolveWorkspaceVisualHeightPx(700, { height: 680, offsetTop: 40 }),
    ).toBe(720);
  });
});
