/**
 * Ozer design token variable names for use in TypeScript (Tailwind arbitrary values, charts, etc.).
 * Source of truth for values: apps/web/styles/ozer-tokens.css
 */
export const ozerTokens = {
  accent: 'var(--ozer-accent)',
  accentHover: 'var(--ozer-accent-hover)',
  accentMuted: 'var(--ozer-accent-muted)',
  surfaceCanvas: 'var(--ozer-surface-canvas)',
  surfacePanel: 'var(--ozer-surface-panel)',
  textOnDark: 'var(--ozer-text-on-dark)',
  textOnDarkMuted: 'var(--ozer-text-on-dark-muted)',
  borderOnDark: 'var(--ozer-border-on-dark)',
  /** @deprecated use accent */
  keelTeal: 'var(--keel-teal)',
} as const;
