import { describe, expect, it } from 'vitest';

import { resolveTokens } from '@kit/site-blocks-core';

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
