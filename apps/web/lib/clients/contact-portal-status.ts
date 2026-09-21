import type { ContactPortalAccessStatus } from '~/lib/clients/client-portal-invites.types';

export type VisiblePortalStatus = Extract<
  ContactPortalAccessStatus,
  'active' | 'invited' | 'revoked'
>;

/** British English labels for statuses shown as pills. */
export const PORTAL_STATUS_LABELS: Record<VisiblePortalStatus, string> = {
  active: 'Active',
  invited: 'Invited',
  revoked: 'Revoked',
};

/**
 * Soft pills — same language as survey / listing chips (tinted, readable on
 * cream and plum). Active is success green; Invited is pending gold; Revoked
 * is destructive red.
 */
export const PORTAL_STATUS_BADGE_CLASS: Record<VisiblePortalStatus, string> = {
  active:
    'bg-emerald-500/15 text-emerald-900 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-300',
  invited:
    'bg-[color-mix(in_srgb,var(--ozer-gold-500)_20%,transparent)] text-[var(--ozer-plum-800)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--ozer-gold-500)_42%,transparent)] dark:bg-[color-mix(in_srgb,var(--ozer-gold-500)_18%,transparent)] dark:text-[var(--ozer-gold-500)] dark:ring-[color-mix(in_srgb,var(--ozer-gold-500)_30%,transparent)]',
  revoked:
    'bg-red-500/15 text-red-700 ring-1 ring-inset ring-red-500/25 dark:text-red-400',
};

export function isVisiblePortalStatus(
  status?: ContactPortalAccessStatus | null,
): status is VisiblePortalStatus {
  return status === 'active' || status === 'invited' || status === 'revoked';
}

export function portalStatusDisplayLabel(
  status?: ContactPortalAccessStatus | null,
): string | null {
  if (!isVisiblePortalStatus(status)) return null;
  return PORTAL_STATUS_LABELS[status];
}

export function portalStatusBadgeClass(
  status?: ContactPortalAccessStatus | null,
): string | null {
  if (!isVisiblePortalStatus(status)) return null;
  return PORTAL_STATUS_BADGE_CLASS[status];
}
