import type { CSSProperties } from 'react';

/**
 * Minimal StyleTokens shape accepted by resolveTokens.
 * Matches apps/web WebsiteStyleTokens (D1) — kept local so the package
 * does not depend on the web app.
 */
export type ResolvableStyleTokens = {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    neutrals: string[];
    success: string;
    warning: string;
    danger: string;
  };
  typography: {
    displayFamily: string;
    bodyFamily: string;
    typeScale: { base: number; ratio: number };
    weights: { regular: number; medium: number; bold: number };
  };
  radius: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    full: string;
  };
  spacingDensity: 'compact' | 'comfortable' | 'spacious';
  buttons: { style: 'pill' | 'rounded' | 'square' };
};

function spacingScale(density: ResolvableStyleTokens['spacingDensity']) {
  const factor =
    density === 'compact' ? 0.85 : density === 'spacious' ? 1.2 : 1;
  const base = (n: number) => `${(n * factor).toFixed(3).replace(/\.?0+$/, '')}rem`;
  return {
    '--sb-space-1': base(0.25),
    '--sb-space-2': base(0.5),
    '--sb-space-3': base(0.75),
    '--sb-space-4': base(1),
    '--sb-space-6': base(1.5),
    '--sb-space-8': base(2),
    '--sb-space-12': base(3),
    '--sb-space-16': base(4),
  };
}

function buttonRadius(
  style: ResolvableStyleTokens['buttons']['style'],
  radius: ResolvableStyleTokens['radius'],
) {
  if (style === 'pill') return radius.full;
  if (style === 'square') return radius.none;
  return radius.md;
}

/**
 * Map StyleTokens → CSS variable map for `.sb-root` / site-blocks.
 * Components must consume ONLY these variables (plus wireframe overrides).
 */
export function resolveTokens(
  tokens: ResolvableStyleTokens,
): Record<string, string> {
  const neutrals = tokens.colors.neutrals;
  const n0 = neutrals[0] ?? '#FAFAF8';
  const n1 = neutrals[1] ?? '#F3F2EF';
  const n2 = neutrals[2] ?? '#E8E6E1';
  const n3 = neutrals[3] ?? '#C9C5BD';
  const n4 = neutrals[4] ?? '#6B6862';
  const n5 = neutrals[5] ?? neutrals[neutrals.length - 2] ?? '#3F3D3A';
  const n6 = neutrals[neutrals.length - 1] ?? '#1C1B1A';

  const { base, ratio } = tokens.typography.typeScale;
  const step = (n: number) => `${(base * Math.pow(ratio, n)).toFixed(2)}px`;

  return {
    '--sb-color-primary': tokens.colors.primary,
    '--sb-color-secondary': tokens.colors.secondary,
    '--sb-color-accent': tokens.colors.accent,
    '--sb-color-success': tokens.colors.success,
    '--sb-color-warning': tokens.colors.warning,
    '--sb-color-danger': tokens.colors.danger,
    '--sb-color-neutral-0': n0,
    '--sb-color-neutral-1': n1,
    '--sb-color-neutral-2': n2,
    '--sb-color-neutral-3': n3,
    '--sb-color-neutral-4': n4,
    '--sb-color-neutral-5': n5,
    '--sb-color-neutral-6': n6,

    // Semantic aliases used by existing blocks.
    '--sb-canvas': n0,
    '--sb-surface': n1,
    '--sb-atmosphere': n2,
    '--sb-border': n3,
    '--sb-ink-muted': n4,
    '--sb-ink': n6,
    '--sb-accent': tokens.colors.accent,
    '--sb-accent-contrast': n0,
    '--sb-color-primary-contrast': n0,

    '--sb-font-display': `"${tokens.typography.displayFamily}", ui-sans-serif, system-ui, sans-serif`,
    '--sb-font-heading': `"${tokens.typography.displayFamily}", ui-sans-serif, system-ui, sans-serif`,
    '--sb-font-body': `"${tokens.typography.bodyFamily}", ui-sans-serif, system-ui, sans-serif`,
    '--sb-font-weight-regular': String(tokens.typography.weights.regular),
    '--sb-font-weight-medium': String(tokens.typography.weights.medium),
    '--sb-font-weight-bold': String(tokens.typography.weights.bold),
    '--sb-font-size-base': `${base}px`,
    '--sb-font-size-sm': step(-1),
    '--sb-font-size-lg': step(1),
    '--sb-font-size-xl': step(2),
    '--sb-font-size-2xl': step(3),
    '--sb-type-ratio': String(ratio),

    '--sb-radius-none': tokens.radius.none,
    '--sb-radius-sm': tokens.radius.sm,
    '--sb-radius-md': tokens.radius.md,
    '--sb-radius-lg': tokens.radius.lg,
    '--sb-radius-full': tokens.radius.full,
    '--sb-button-radius': buttonRadius(tokens.buttons.style, tokens.radius),

    ...spacingScale(tokens.spacingDensity),
  };
}

export function resolveTokensStyle(
  tokens: ResolvableStyleTokens,
): CSSProperties {
  return resolveTokens(tokens) as CSSProperties;
}
