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
  };
}

const RSVP_FIELD_RE = /attend|rsvp|coming/;

export type WorkspaceFormLayoutHints = {
  eventAddress?: string | null;
  destination?: string | null;
  submitLabel?: string | null;
  name?: string | null;
  fields?: Array<{ type: string; key: string; label: string }>;
};

function isAttendanceLikeField(field: {
  type: string;
  key: string;
  label: string;
}): boolean {
  return RSVP_FIELD_RE.test(`${field.key} ${field.label}`.toLowerCase());
}

/**
 * Public / builder layout. Existing RSVPs created before the event layout
 * flag still have theme.layout = standard (or omitted). Force two-column
 * for RSVP / event forms so they do not need to be recreated.
 */
export function resolveWorkspaceFormLayout(
  stored: WorkspaceFormLayout | null | undefined,
  hints: WorkspaceFormLayoutHints = {},
): WorkspaceFormLayout {
  if (stored === 'event') return 'event';
  if (hints.eventAddress?.trim()) return 'event';

  const fields = hints.fields ?? [];
  const hasYesNo = fields.some((field) => field.type === 'yes_no');
  const hasAttendanceField = fields.some(isAttendanceLikeField);
  const rsvpCopy = /rsvp/i.test(
    `${hints.submitLabel ?? ''} ${hints.name ?? ''}`,
  );

  if (hasAttendanceField) return 'event';
  if (hasYesNo && hints.destination === 'submission_list') return 'event';
  if (rsvpCopy && (hasYesNo || hints.destination === 'submission_list')) {
    return 'event';
  }

  return 'standard';
}

export function withResolvedFormLayout(
  theme: WorkspaceFormTheme,
  hints: WorkspaceFormLayoutHints,
): WorkspaceFormTheme {
  return {
    ...theme,
    layout: resolveWorkspaceFormLayout(theme.layout, hints),
  };
}

export function serializeWorkspaceFormTheme(
  theme: Partial<WorkspaceFormTheme> | WorkspaceFormTheme,
): WorkspaceFormTheme {
  return parseWorkspaceFormTheme(theme);
}
