/**
 * Ozer design token variable names and resolved hex for charts, emails, and server defaults.
 * Source of truth for CSS values: apps/web/styles/ozer-tokens.css
 */
export const ozerTokens = {
  accent: 'var(--ozer-accent)',
  accentHover: 'var(--ozer-accent-hover)',
  accentMuted: 'var(--ozer-accent-muted)',
  accentSubtle: 'var(--ozer-accent-subtle)',
  surfaceCanvas: 'var(--ozer-surface-canvas)',
  surfacePanel: 'var(--ozer-surface-panel)',
  textOnDark: 'var(--ozer-text-on-dark)',
  textOnDarkMuted: 'var(--ozer-text-on-dark-muted)',
  borderOnDark: 'var(--ozer-border-on-dark)',
  info: 'var(--ozer-info)',
  /** @deprecated use accent */
  keelTeal: 'var(--ozer-accent)',
} as const;

/** Resolved hex/rgba for programmatic use (Recharts, default phase colours, emails). */
export const ozerColors = {
  accent: '#FF5C34',
  accentHover: '#FF7A5C',
  accentPressed: '#C2452A',
  accentMuted: '#FFE3DA',
  accentSubtle: 'rgba(255, 92, 52, 0.15)',
  accentSubtleStrong: 'rgba(255, 92, 52, 0.2)',
  surfaceCanvas: '#351E28',
  surfacePanel: '#2A1720',
  cream: '#FBF6EC',
  plum: '#2A1720',
  info: '#41606F',
  gold: '#F0C14B',
  lime: '#E9F056',
  white: '#FFFFFF',
  muted: '#B7A4AC',
} as const;

/** Workspace space-type accents (charts, orbit, badges). */
export const ozerWorkspaceSpaceColors = {
  work: ozerColors.info,
  property: ozerColors.accent,
  family: '#059669',
  community: ozerColors.gold,
} as const;

/** PM / kanban status palette (needs resolved hex for inline styles). */
export const ozerStatusColors = {
  pending: ozerColors.info,
  inProgress: ozerColors.accent,
  onHold: ozerColors.gold,
  completed: '#059669',
  cancelled: ozerColors.muted,
  urgent: ozerColors.accentPressed,
  high: ozerColors.accent,
  medium: ozerColors.gold,
  low: ozerColors.muted,
} as const;

/** Default accent for project phases and AI-generated colours. */
export const OZER_DEFAULT_PHASE_COLOUR = ozerColors.accent;
