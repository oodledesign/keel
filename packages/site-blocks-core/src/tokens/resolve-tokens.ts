import type { CSSProperties } from 'react';

/**
 * Minimal StyleTokens shape accepted by resolveTokens.
 * Matches apps/web WebsiteStyleTokens (D1) — kept local so the package
 * does not depend on the web app.
 */
export type ResolvableHeadingLevel = {
  sizePx?: number | null;
  weight?: number | null;
};

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
    headings: {
      h1: ResolvableHeadingLevel;
      h2: ResolvableHeadingLevel;
      h3: ResolvableHeadingLevel;
    };
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
  const base = (n: number) =>
    `${(n * factor).toFixed(3).replace(/\.?0+$/, '')}rem`;
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

function sanitizeFontFamily(name: string) {
  return name.replace(/["\\;]/g, '').trim() || 'ui-sans-serif';
}

function normalizeHeadingLevel(
  value: ResolvableHeadingLevel | undefined,
): ResolvableHeadingLevel {
  if (!value || typeof value !== 'object') return {};
  const sizePx =
    value.sizePx == null || Number.isNaN(Number(value.sizePx))
      ? null
      : Number(value.sizePx);
  const weight =
    value.weight == null || Number.isNaN(Number(value.weight))
      ? null
      : Number(value.weight);
  return {
    ...(sizePx != null && sizePx > 0 ? { sizePx } : {}),
    ...(weight != null && weight > 0 ? { weight } : {}),
  };
}

export const DEFAULT_RESOLVABLE_STYLE_TOKENS: ResolvableStyleTokens = {
  colors: {
    primary: '#2F5D50',
    secondary: '#6B8F71',
    accent: '#FF5C34',
    neutrals: [
      '#FAFAF8',
      '#F3F2EF',
      '#E8E6E1',
      '#C9C5BD',
      '#6B6862',
      '#3F3D3A',
      '#1C1B1A',
    ],
    success: '#2F7D4A',
    warning: '#C9852A',
    danger: '#B42318',
  },
  typography: {
    displayFamily: 'Cabinet Grotesk',
    bodyFamily: 'General Sans',
    typeScale: { base: 16, ratio: 1.25 },
    weights: { regular: 400, medium: 500, bold: 700 },
    headings: { h1: {}, h2: {}, h3: {} },
  },
  radius: {
    none: '0px',
    sm: '0.375rem',
    md: '0.75rem',
    lg: '1.25rem',
    full: '9999px',
  },
  spacingDensity: 'comfortable',
  buttons: { style: 'rounded' },
};

/** Merge partial / legacy theme JSON into a complete ResolvableStyleTokens shape. */
export function coerceResolvableStyleTokens(
  input: unknown,
): ResolvableStyleTokens {
  const defaults = DEFAULT_RESOLVABLE_STYLE_TOKENS;
  if (!input || typeof input !== 'object') return defaults;

  const raw = input as Partial<ResolvableStyleTokens> & {
    colors?: Partial<ResolvableStyleTokens['colors']>;
    typography?: Partial<ResolvableStyleTokens['typography']>;
    radius?: Partial<ResolvableStyleTokens['radius']>;
    buttons?: Partial<ResolvableStyleTokens['buttons']>;
  };

  const neutrals =
    Array.isArray(raw.colors?.neutrals) && raw.colors.neutrals.length >= 5
      ? raw.colors.neutrals.map(String)
      : defaults.colors.neutrals;

  return {
    colors: {
      ...defaults.colors,
      ...raw.colors,
      neutrals,
    },
    typography: {
      ...defaults.typography,
      ...raw.typography,
      typeScale: {
        ...defaults.typography.typeScale,
        ...raw.typography?.typeScale,
      },
      weights: {
        ...defaults.typography.weights,
        ...raw.typography?.weights,
      },
      headings: {
        h1: normalizeHeadingLevel(
          raw.typography?.headings?.h1 ?? defaults.typography.headings.h1,
        ),
        h2: normalizeHeadingLevel(
          raw.typography?.headings?.h2 ?? defaults.typography.headings.h2,
        ),
        h3: normalizeHeadingLevel(
          raw.typography?.headings?.h3 ?? defaults.typography.headings.h3,
        ),
      },
      displayFamily: sanitizeFontFamily(
        raw.typography?.displayFamily ?? defaults.typography.displayFamily,
      ),
      bodyFamily: sanitizeFontFamily(
        raw.typography?.bodyFamily ?? defaults.typography.bodyFamily,
      ),
    },
    radius: { ...defaults.radius, ...raw.radius },
    spacingDensity: raw.spacingDensity ?? defaults.spacingDensity,
    buttons: { ...defaults.buttons, ...raw.buttons },
  };
}

function headingSizePx(
  level: ResolvableHeadingLevel,
  fallbackPx: number,
): string {
  const explicit = level.sizePx;
  if (explicit != null && explicit > 0) return `${explicit}px`;
  return `${fallbackPx.toFixed(2)}px`;
}

function headingWeight(
  level: ResolvableHeadingLevel,
  fallback: number,
): string {
  const explicit = level.weight;
  if (explicit != null && explicit > 0) return String(explicit);
  return String(fallback);
}

/**
 * Map StyleTokens → CSS variable map for `.sb-root` / site-blocks.
 * Components must consume ONLY these variables (plus wireframe overrides).
 */
export function resolveTokens(
  tokens: ResolvableStyleTokens,
): Record<string, string> {
  const resolved = coerceResolvableStyleTokens(tokens);
  const neutrals = resolved.colors.neutrals;
  const n0 = neutrals[0] ?? '#FAFAF8';
  const n1 = neutrals[1] ?? '#F3F2EF';
  const n2 = neutrals[2] ?? '#E8E6E1';
  const n3 = neutrals[3] ?? '#C9C5BD';
  const n4 = neutrals[4] ?? '#6B6862';
  const n5 = neutrals[5] ?? neutrals[neutrals.length - 2] ?? '#3F3D3A';
  const n6 = neutrals[neutrals.length - 1] ?? '#1C1B1A';

  const { base, ratio } = resolved.typography.typeScale;
  const step = (n: number) => base * Math.pow(ratio, n);
  const { headings, weights } = resolved.typography;
  const h1Size = headingSizePx(headings.h1, step(3));
  const h2Size = headingSizePx(headings.h2, step(2));
  const h3Size = headingSizePx(headings.h3, step(1));

  return {
    '--sb-color-primary': resolved.colors.primary,
    '--sb-color-secondary': resolved.colors.secondary,
    '--sb-color-accent': resolved.colors.accent,
    '--sb-color-success': resolved.colors.success,
    '--sb-color-warning': resolved.colors.warning,
    '--sb-color-danger': resolved.colors.danger,
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
    '--sb-accent': resolved.colors.accent,
    '--sb-accent-contrast': n0,
    '--sb-color-primary-contrast': n0,

    '--sb-font-display': `"${resolved.typography.displayFamily}", ui-sans-serif, system-ui, sans-serif`,
    '--sb-font-heading': `"${resolved.typography.displayFamily}", ui-sans-serif, system-ui, sans-serif`,
    '--sb-font-body': `"${resolved.typography.bodyFamily}", ui-sans-serif, system-ui, sans-serif`,
    '--sb-font-weight-regular': String(weights.regular),
    '--sb-font-weight-medium': String(weights.medium),
    '--sb-font-weight-bold': String(weights.bold),
    '--sb-font-size-base': `${base}px`,
    '--sb-font-size-sm': `${step(-1).toFixed(2)}px`,
    '--sb-font-size-lg': `${step(1).toFixed(2)}px`,
    '--sb-font-size-xl': `${step(2).toFixed(2)}px`,
    '--sb-font-size-2xl': `${step(3).toFixed(2)}px`,
    '--sb-font-size-h1': h1Size,
    '--sb-font-size-h2': h2Size,
    '--sb-font-size-h3': h3Size,
    '--sb-font-weight-h1': headingWeight(headings.h1, weights.bold),
    '--sb-font-weight-h2': headingWeight(headings.h2, weights.bold),
    '--sb-font-weight-h3': headingWeight(headings.h3, weights.bold),
    '--sb-type-ratio': String(ratio),

    '--sb-radius-none': resolved.radius.none,
    '--sb-radius-sm': resolved.radius.sm,
    '--sb-radius-md': resolved.radius.md,
    '--sb-radius-lg': resolved.radius.lg,
    '--sb-radius-full': resolved.radius.full,
    '--sb-button-radius': buttonRadius(
      resolved.buttons.style,
      resolved.radius,
    ),

    ...spacingScale(resolved.spacingDensity),
  };
}

export function resolveTokensStyle(
  tokens: ResolvableStyleTokens,
): CSSProperties {
  return resolveTokens(tokens) as CSSProperties;
}

/** Default px sizes derived from the modular scale (for editor UI placeholders). */
export function derivedHeadingSizes(tokens: ResolvableStyleTokens): {
  h1: number;
  h2: number;
  h3: number;
} {
  const resolved = coerceResolvableStyleTokens(tokens);
  const { base, ratio } = resolved.typography.typeScale;
  const step = (n: number) => Number((base * Math.pow(ratio, n)).toFixed(2));
  return {
    h1: resolved.typography.headings.h1.sizePx ?? step(3),
    h2: resolved.typography.headings.h2.sizePx ?? step(2),
    h3: resolved.typography.headings.h3.sizePx ?? step(1),
  };
}
