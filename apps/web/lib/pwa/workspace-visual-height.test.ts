import { describe, expect, it } from 'vitest';

import {
  resolveWorkspaceVisualHeightCss,
  resolveWorkspaceVisualHeightPx,
} from '~/lib/pwa/workspace-visual-height';

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

describe('resolveWorkspaceVisualHeightCss', () => {
  it('keeps the taller reported viewport when this is not an iOS shell', () => {
    expect(
      resolveWorkspaceVisualHeightCss({
        innerHeight: 844,
        visualViewport: { height: 720, offsetTop: 0 },
        screenHeight: 844,
      }),
    ).toBe('844px');
  });

  it('uses 100vh in standalone so a short innerHeight cannot leave a bottom band', () => {
    expect(
      resolveWorkspaceVisualHeightCss({
        innerHeight: 879,
        visualViewport: { height: 879, offsetTop: 0 },
        screenHeight: 926,
        standalone: true,
        ios: true,
      }),
    ).toBe('100vh');
  });

  it('uses 100vh in standalone when screen.height is missing', () => {
    expect(
      resolveWorkspaceVisualHeightCss({
        innerHeight: 793,
        visualViewport: { height: 793, offsetTop: 0 },
        standalone: true,
      }),
    ).toBe('100vh');
  });

  it('shrinks a standalone shell to the visual viewport while the keyboard is open', () => {
    expect(
      resolveWorkspaceVisualHeightCss({
        innerHeight: 852,
        visualViewport: { height: 420, offsetTop: 0 },
        screenHeight: 852,
        standalone: true,
        ios: true,
      }),
    ).toBe('420px');
  });

  it('fills an iOS browser gap that is only the safe-area shortfall', () => {
    expect(
      resolveWorkspaceVisualHeightCss({
        innerHeight: 845,
        visualViewport: { height: 845, offsetTop: 0 },
        screenHeight: 926,
        ios: true,
      }),
    ).toBe('100vh');
  });

  it('does not cover a visible Safari toolbar with 100vh', () => {
    expect(
      resolveWorkspaceVisualHeightCss({
        innerHeight: 700,
        visualViewport: { height: 690, offsetTop: 0 },
        screenHeight: 926,
        ios: true,
      }),
    ).toBe('700px');
  });

  it('ignores a physical-pixel screen.height and still uses 100vh when installed', () => {
    expect(
      resolveWorkspaceVisualHeightCss({
        innerHeight: 879,
        visualViewport: { height: 879, offsetTop: 0 },
        screenHeight: 2778,
        standalone: true,
        ios: true,
      }),
    ).toBe('100vh');
  });
});
