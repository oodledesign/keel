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
  /** True after the editor saved a public-layout choice. */
  layoutExplicit: boolean;
};

export const DEFAULT_WORKSPACE_FORM_THEME: WorkspaceFormTheme = {
  pageBackground: 'light',
  layout: 'standard',
  layoutExplicit: false,
};

export const WORKSPACE_FORM_LAYOUT_LABELS: Record<
  WorkspaceFormLayout,
  { label: string; description: string }
> = {
  standard: {
    label: 'Standard (single column)',
    description: 'Logo and intro stacked above the form on every screen size.',
  },
  event: {
    label: 'Event / two-column',
    description:
      'RSVP public layout: desktop shows event details on the left and the form on the right. Mobile stays stacked. New RSVPs use this by default.',
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

function readStoredLayout(raw: object): WorkspaceFormLayout | null {
  const row = raw as {
    layout?: unknown;
    pageLayout?: unknown;
    formLayout?: unknown;
  };
  const value = row.layout ?? row.pageLayout ?? row.formLayout;
  if (value === 'event' || value === 'rsvp') return 'event';
  if (value === 'standard') return 'standard';
  return null;
}

export function parseWorkspaceFormTheme(raw: unknown): WorkspaceFormTheme {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_WORKSPACE_FORM_THEME };
  }
  const pageBackground =
    (raw as { pageBackground?: unknown }).pageBackground === 'brand_gradient'
      ? 'brand_gradient'
      : 'light';
  return {
    pageBackground,
    layout: readStoredLayout(raw) ?? 'standard',
    layoutExplicit:
      (raw as { layoutExplicit?: unknown }).layoutExplicit === true,
  };
}

export type WorkspaceFormLayoutHints = {
  eventAddress?: string | null;
  eventDate?: string | null;
  eventTime?: string | null;
  destination?: string | null;
  submitLabel?: string | null;
  name?: string | null;
  fields?: Array<{ type: string; key: string; label: string }>;
};

const RSVP_FIELD_RE = /attend|rsvp|coming/;

export function isRsvpLikeWorkspaceForm(
  hints: WorkspaceFormLayoutHints,
): boolean {
  if (hints.eventAddress?.trim()) return true;
  if (hints.eventDate?.trim() || hints.eventTime?.trim()) return true;
  if (/rsvp/i.test(`${hints.submitLabel ?? ''} ${hints.name ?? ''}`)) {
    return true;
  }

  const fields = hints.fields ?? [];
  const hasAttendanceChoice = fields.some(
    (field) =>
      (field.type === 'yes_no' ||
        field.type === 'select' ||
        field.type === 'radio') &&
      RSVP_FIELD_RE.test(`${field.key} ${field.label}`.toLowerCase()),
  );
  if (hasAttendanceChoice) return true;

  return (
    hints.destination === 'submission_list' &&
    fields.some((field) => field.type === 'yes_no')
  );
}

/**
 * Existing RSVPs often still store theme.layout = standard because that was
 * the parse default, not a user choice. Default those to event / two-column.
 * Honor an explicit Standard (or Event) choice after the editor saves
 * `layoutExplicit: true`.
 */
export function resolveWorkspaceFormLayout(
  theme: Pick<WorkspaceFormTheme, 'layout' | 'layoutExplicit'>,
  hints: WorkspaceFormLayoutHints = {},
): WorkspaceFormLayout {
  if (theme.layout === 'event') return 'event';
  if (theme.layoutExplicit) return 'standard';
  if (isRsvpLikeWorkspaceForm(hints)) return 'event';
  return 'standard';
}

export function withResolvedFormLayout(
  theme: WorkspaceFormTheme,
  hints: WorkspaceFormLayoutHints,
): WorkspaceFormTheme {
  return {
    ...theme,
    layout: resolveWorkspaceFormLayout(theme, hints),
  };
}

export function serializeWorkspaceFormTheme(
  theme: Partial<WorkspaceFormTheme> | WorkspaceFormTheme,
): WorkspaceFormTheme {
  const parsed = parseWorkspaceFormTheme(theme);
  return {
    pageBackground: parsed.pageBackground,
    layout: parsed.layout,
    layoutExplicit: parsed.layoutExplicit,
  };
}
