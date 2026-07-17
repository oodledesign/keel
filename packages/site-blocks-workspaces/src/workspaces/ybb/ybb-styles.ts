import type { CSSProperties } from 'react';

export type YbbBackgroundToken =
  | 'atmosphere'
  | 'surface'
  | 'canvas'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'custom';

export type YbbCtaVariant = 'primary' | 'secondary' | 'tertiary' | 'text';

export const YBB_BACKGROUND_TOKEN_OPTIONS = [
  { label: 'Atmosphere (N2)', value: 'atmosphere' },
  { label: 'Surface (N1)', value: 'surface' },
  { label: 'Canvas (N0)', value: 'canvas' },
  { label: 'Primary brand', value: 'primary' },
  { label: 'Secondary brand', value: 'secondary' },
  { label: 'Accent', value: 'accent' },
  { label: 'Custom colour', value: 'custom' },
] as const;

export const YBB_CTA_VARIANT_OPTIONS = [
  { label: 'Primary (filled)', value: 'primary' },
  { label: 'Secondary (outline)', value: 'secondary' },
  { label: 'Tertiary (accent fill)', value: 'tertiary' },
  { label: 'Text link', value: 'text' },
] as const;

const BACKGROUND_VAR: Record<Exclude<YbbBackgroundToken, 'custom'>, string> = {
  atmosphere: 'var(--sb-atmosphere)',
  surface: 'var(--sb-surface)',
  canvas: 'var(--sb-canvas)',
  primary: 'var(--sb-color-primary)',
  secondary: 'var(--sb-color-secondary)',
  accent: 'var(--sb-color-accent)',
};

export function resolveYbbBackgroundStyle(input: {
  backgroundToken?: string;
  backgroundColor?: string;
}): CSSProperties {
  const token = (input.backgroundToken ?? 'atmosphere') as YbbBackgroundToken;
  if (token === 'custom') {
    return input.backgroundColor?.trim()
      ? { background: input.backgroundColor.trim() }
      : { background: BACKGROUND_VAR.atmosphere };
  }
  const resolved = BACKGROUND_VAR[token as Exclude<YbbBackgroundToken, 'custom'>] ?? BACKGROUND_VAR.atmosphere;
  return { background: resolved };
}

export function ybbCtaClassName(
  variant: string | undefined,
  onDark = false,
): string {
  const base = (() => {
    switch (variant as YbbCtaVariant) {
      case 'secondary':
        return 'ybbBtnSecondary';
      case 'tertiary':
        return 'ybbBtnTertiary';
      case 'text':
        return 'ybbBtnText';
      case 'primary':
      default:
        return 'ybbBtnPrimary';
    }
  })();
  return onDark ? `${base} ybbBtnOnDark` : base;
}

export type YbbPolaroidCtaColor = 'green' | 'rose' | 'cress';

export function ybbPolaroidCtaClass(color: string | undefined): string {
  switch (color as YbbPolaroidCtaColor) {
    case 'rose':
      return 'ybbPolaroidCtaRose';
    case 'cress':
      return 'ybbPolaroidCtaCress';
    case 'green':
    default:
      return 'ybbPolaroidCtaGreen';
  }
}

export function resolveYbbColorVar(input: {
  token?: string;
  customColor?: string;
  fallback?: string;
}): string {
  const token = (input.token ?? 'custom') as YbbBackgroundToken;
  if (token === 'custom' && input.customColor?.trim()) {
    return input.customColor.trim();
  }
  if (token !== 'custom') {
    return BACKGROUND_VAR[token] ?? input.fallback ?? BACKGROUND_VAR.atmosphere;
  }
  return input.fallback ?? BACKGROUND_VAR.atmosphere;
}
