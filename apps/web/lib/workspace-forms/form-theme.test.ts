import { describe, expect, it } from 'vitest';

import {
  brandPageGradientCss,
  darkenHex,
  parseWorkspaceFormTheme,
} from './form-theme';

describe('darkenHex', () => {
  it('darkens a 6-digit hex toward black', () => {
    expect(darkenHex('#0D2344', 0.16).toLowerCase()).toBe('#0b1d39');
  });

  it('expands 3-digit hex', () => {
    expect(darkenHex('#abc', 0).toLowerCase()).toBe('#aabbcc');
  });

  it('returns invalid input unchanged', () => {
    expect(darkenHex('navy', 0.2)).toBe('navy');
  });
});

describe('brandPageGradientCss', () => {
  it('builds a 135deg primary → darker gradient', () => {
    expect(brandPageGradientCss('#0D2344')).toBe(
      'linear-gradient(135deg, #0D2344, #0b1d39)',
    );
  });
});

describe('parseWorkspaceFormTheme', () => {
  it('defaults to light standard', () => {
    expect(parseWorkspaceFormTheme(null)).toEqual({
      pageBackground: 'light',
      layout: 'standard',
    });
  });

  it('reads brand_gradient and event layout', () => {
    expect(
      parseWorkspaceFormTheme({
        pageBackground: 'brand_gradient',
        layout: 'event',
      }),
    ).toEqual({ pageBackground: 'brand_gradient', layout: 'event' });
  });
});
