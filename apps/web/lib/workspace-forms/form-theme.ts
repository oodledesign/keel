/**
 * Per-form presentation theme (stored in workspace_forms.theme jsonb).
 * Client-safe — no Node crypto.
 */

export const WORKSPACE_FORM_PAGE_BACKGROUNDS = [
  'light',
  'brand_gradient',
] as const;

export type WorkspaceFormPageBackground =
  (typeof WORKSPACE_FORM_PAGE_BACKGROUNDS)[number];

export const WORKSPACE_FORM_LAYOUTS = ['standard', 'event'] as const;

export type WorkspaceFormLayout = (typeof WORKSPACE_FORM_LAYOUTS)[number];

export type WorkspaceFormTheme = {
  pageBackground: WorkspaceFormPageBackground;
  layout: WorkspaceFormLayout;
};

export const DEFAULT_WORKSPACE_FORM_THEME: WorkspaceFormTheme = {
  pageBackground: 'light',
  layout: 'standard',
};

export const WORKSPACE_FORM_LAYOUT_LABELS: Record<
  WorkspaceFormLayout,
  { label: string; description: string }
> = {
  standard: {
    label: 'Standard',
    description: 'Logo and intro stacked above the form.',
  },
  event: {
    label: 'Event / RSVP',
    description:
      'Two columns on desktop: event details on the left, form on the right.',
  },
};

export const WORKSPACE_FORM_PAGE_BACKGROUND_LABELS: Record<
  WorkspaceFormPageBackground,
  { label: string; description: string }
> = {
  light: {
    label: 'Default / Light',
    description: 'Neutral light page behind the form card.',
  },
  brand_gradient: {
    label: 'Brand gradient',
    description:
      'Workspace primary colour with a slight diagonal gradient to a darker shade.',
  },
};

const HEX_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

function expandHex(hex: string): string {
  const raw = hex.slice(1);
  if (raw.length === 3) {
    return `#${raw
      .split('')
      .map((ch) => ch + ch)
      .join('')}`;
  }
  return `#${raw}`;
}

/** Mix hex colour toward black by `amount` (0–1). Returns #rrggbb. */
export function darkenHex(hex: string, amount = 0.16): string {
  if (!HEX_RE.test(hex)) return hex;
  const full = expandHex(hex);
  const n = Math.min(1, Math.max(0, amount));
  const r = parseInt(full.slice(1, 3), 16);
  const g = parseInt(full.slice(3, 5), 16);
  const b = parseInt(full.slice(5, 7), 16);
  const to = (c: number) =>
    Math.round(c * (1 - n))
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** CSS linear-gradient for brand page background (135deg). */
export function brandPageGradientCss(primaryColor: string): string {
  const darker = darkenHex(primaryColor, 0.16);
  return `linear-gradient(135deg, ${primaryColor}, ${darker})`;
}

export function parseWorkspaceFormTheme(raw: unknown): WorkspaceFormTheme {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_WORKSPACE_FORM_THEME };
  }
  const row = raw as { pageBackground?: unknown; layout?: unknown };
  const pageBackground =
    row.pageBackground === 'brand_gradient' ? 'brand_gradient' : 'light';
  const layout = row.layout === 'event' ? 'event' : 'standard';
  return { pageBackground, layout };
}

export function serializeWorkspaceFormTheme(
  theme: WorkspaceFormTheme,
): WorkspaceFormTheme {
  return {
    pageBackground:
      theme.pageBackground === 'brand_gradient' ? 'brand_gradient' : 'light',
    layout: theme.layout === 'event' ? 'event' : 'standard',
  };
}
