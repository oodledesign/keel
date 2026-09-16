/**
 * Survey report status pills. Surveys reuse `proposals.status`
 * (`draft` | `sent` | `read` | `approved` | `declined`). Aliases cover
 * labels people may type or older copy (in progress, published, archived).
 */

export const SURVEY_STATUS_TONES = [
  'draft',
  'in_progress',
  'sent',
  'read',
  'approved',
  'declined',
  'archived',
  'unknown',
] as const;

export type SurveyStatusTone = (typeof SURVEY_STATUS_TONES)[number];

/** British English labels for stored slugs. */
export const SURVEY_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  in_progress: 'In progress',
  inprogress: 'In progress',
  sent: 'Sent',
  published: 'Published',
  read: 'Read',
  approved: 'Approved',
  declined: 'Declined',
  archived: 'Archived',
};

const TONE_BY_KEY: Record<string, SurveyStatusTone> = {
  draft: 'draft',
  in_progress: 'in_progress',
  inprogress: 'in_progress',
  sent: 'sent',
  published: 'sent',
  read: 'read',
  approved: 'approved',
  declined: 'declined',
  archived: 'archived',
};

/**
 * Soft pills — same language as listing / task chips (tinted, readable on
 * cream and plum). Draft is amber/grey; sent/published green; archived muted.
 */
export const SURVEY_STATUS_BADGE_CLASS: Record<SurveyStatusTone, string> = {
  draft:
    'bg-[color-mix(in_srgb,var(--ozer-gold-500)_20%,transparent)] text-[var(--ozer-plum-800)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--ozer-gold-500)_42%,transparent)] dark:text-[var(--ozer-gold-500)]',
  in_progress:
    'bg-[color-mix(in_srgb,var(--ozer-info)_12%,transparent)] text-[var(--ozer-info)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--ozer-info)_28%,transparent)] dark:text-[var(--ozer-sky-200)]',
  sent: 'bg-[var(--ozer-sage-100)] text-[var(--ozer-plum-800)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--ozer-sage-500)_50%,transparent)] dark:bg-[color-mix(in_srgb,var(--ozer-sage-500)_18%,transparent)] dark:text-[var(--ozer-sage-300)]',
  read: 'bg-amber-500/15 text-amber-900 ring-1 ring-inset ring-amber-500/30 dark:text-amber-200',
  approved:
    'bg-emerald-500/15 text-emerald-900 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-300',
  declined:
    'bg-red-500/15 text-red-700 ring-1 ring-inset ring-red-500/25 dark:text-red-400',
  archived:
    'bg-[color-mix(in_srgb,var(--ozer-text-muted)_18%,transparent)] text-[var(--workspace-shell-text-muted)] ring-1 ring-inset ring-[color:var(--workspace-shell-border)]',
  unknown:
    'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] ring-1 ring-inset ring-[color:var(--workspace-shell-border)]',
};

export function normalizeSurveyStatusKey(
  value: string | null | undefined,
): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function resolveSurveyStatusTone(
  status: string | null | undefined,
): SurveyStatusTone {
  const key = normalizeSurveyStatusKey(status);
  return TONE_BY_KEY[key] ?? 'unknown';
}

export function surveyStatusDisplayLabel(
  status: string | null | undefined,
): string {
  const raw = (status ?? '').trim();
  const key = normalizeSurveyStatusKey(raw);
  if (key && SURVEY_STATUS_LABELS[key]) {
    return SURVEY_STATUS_LABELS[key];
  }
  if (!raw) return 'Draft';
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function surveyStatusBadgeClass(
  status: string | null | undefined,
): string {
  return SURVEY_STATUS_BADGE_CLASS[resolveSurveyStatusTone(status)];
}
