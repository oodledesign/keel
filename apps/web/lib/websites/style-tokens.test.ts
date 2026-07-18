import { describe, expect, it } from 'vitest';

import {
  buildTokensResponsiveStyleSheet,
  resolveTokens,
} from '@kit/site-blocks-core';

import {
  normalizeWebsiteStyleTokens,
  seedStyleTokensBrandA,
  seedStyleTokensBrandB,
} from './style-tokens';

describe('normalizeWebsiteStyleTokens', () => {
  it('migrates legacy 4-role tokens', () => {
    const tokens = normalizeWebsiteStyleTokens({
      canvas: '#FAFAF8',
      atmosphere: '#EEE',
      accent: '#FF5C34',
      contrast: '#111',
      secondary: '#2A9D8F',
      headingFont: 'Fraunces',
      bodyFont: 'Manrope',
      typeScale: 'display',
      radius: 'round',
      spacingDensity: 'airy',
      photographyDirection: 'Warm light',
    });

    expect(tokens.schemaVersion).toBe('1.0');
    expect(tokens.colors.accent).toBe('#FF5C34');
    expect(tokens.colors.neutrals[0]).toBe('#FAFAF8');
    expect(tokens.typography.displayFamily).toBe('Fraunces');
    expect(tokens.spacingDensity).toBe('spacious');
    expect(tokens.buttons.style).toBe('rounded');
  });

  it('keeps D1 shape', () => {
    const brandA = seedStyleTokensBrandA();
    const tokens = normalizeWebsiteStyleTokens(brandA);
    expect(tokens.colors.primary).toBe(brandA.colors.primary);
    expect(tokens.colors.neutrals.length).toBeGreaterThanOrEqual(5);
    expect(tokens.typography.headings).toEqual({ h1: {}, h2: {}, h3: {} });
  });

  it('preserves explicit heading sizes', () => {
    const tokens = normalizeWebsiteStyleTokens({
      ...seedStyleTokensBrandA(),
      typography: {
        ...seedStyleTokensBrandA().typography,
        headings: {
          h1: { sizePx: 48, weight: 700 },
          h2: { sizePx: 32 },
          h3: {},
        },
      },
    });
    expect(tokens.typography.headings.h1).toEqual({ sizePx: 48, weight: 700 });
    expect(tokens.typography.headings.h2).toEqual({ sizePx: 32 });
    expect(resolveTokens(tokens)['--sb-font-size-h1']).toBe('48px');
    expect(resolveTokens(tokens)['--sb-font-weight-h1']).toBe('700');
  });

  it('preserves responsive heading overrides', () => {
    const tokens = normalizeWebsiteStyleTokens({
      ...seedStyleTokensBrandA(),
      typography: {
        ...seedStyleTokensBrandA().typography,
        headings: {
          h1: {
            sizePx: 56,
            tabletSizePx: 40,
            mobileSizePx: 28,
            weight: 700,
            tabletWeight: 600,
          },
          h2: {},
          h3: {},
        },
      },
    });

    expect(tokens.typography.headings.h1).toEqual({
      sizePx: 56,
      tabletSizePx: 40,
      mobileSizePx: 28,
      weight: 700,
      tabletWeight: 600,
    });
  });
});

describe('resolveTokens brand differentiation', () => {
  it('produces visibly different CSS maps for seeded brands', () => {
    const a = resolveTokens(seedStyleTokensBrandA());
    const b = resolveTokens(seedStyleTokensBrandB());

    expect(a['--sb-color-primary']).not.toBe(b['--sb-color-primary']);
    expect(a['--sb-font-display']).not.toBe(b['--sb-font-display']);
    expect(a['--sb-button-radius']).not.toBe(b['--sb-button-radius']);
    expect(a['--sb-space-8']).not.toBe(b['--sb-space-8']);
  });
});

describe('buildTokensResponsiveStyleSheet', () => {
  it('emits tablet and mobile media queries when set', () => {
    const tokens = normalizeWebsiteStyleTokens({
      ...seedStyleTokensBrandA(),
      typography: {
        ...seedStyleTokensBrandA().typography,
        headings: {
          h1: { sizePx: 56, tabletSizePx: 40, mobileSizePx: 28 },
          h2: {},
          h3: {},
        },
      },
    });

    const css = buildTokensResponsiveStyleSheet(tokens, '.sb-root');
    expect(css).toContain('@media (max-width:1023px)');
    expect(css).toContain('@media (max-width:767px)');
    expect(css).toContain('--sb-font-size-h1:40px');
    expect(css).toContain('--sb-font-size-h1:28px');
  });
});
