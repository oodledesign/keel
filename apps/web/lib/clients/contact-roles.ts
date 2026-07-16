/** Canonical contact roles for business clients (stored lowercase on client_contacts.role). */
export const CONTACT_ROLE_PRESETS = [
  'finance',
  'founder',
  'partner',
  'ops',
  'legal',
  'marketing',
  'other',
] as const;

export type ContactRolePreset = (typeof CONTACT_ROLE_PRESETS)[number];

export const CONTACT_ROLE_LABELS: Record<ContactRolePreset, string> = {
  finance: 'Finance',
  founder: 'Founder',
  partner: 'Partner',
  ops: 'Ops',
  legal: 'Legal',
  marketing: 'Marketing',
  other: 'Other',
};

export function normalizeContactRole(
  role: string | null | undefined,
): string | null {
  const trimmed = role?.trim();
  if (!trimmed) return null;
  const normalized = trimmed.toLowerCase();
  // Legacy preset renamed to finance.
  if (normalized === 'accountant') return 'finance';
  return normalized;
}

/** Prefer finance (and legacy accountant) contacts for invoice emails. */
export function isFinanceRole(role: string | null | undefined): boolean {
  const normalized = normalizeContactRole(role);
  if (!normalized) return false;
  return (
    normalized === 'finance' ||
    normalized.includes('finance') ||
    normalized.includes('accountant') ||
    normalized.includes('bookkeep')
  );
}

/** @deprecated Use isFinanceRole */
export const isAccountantRole = isFinanceRole;

export function formatContactRoleLabel(
  role: string | null | undefined,
): string {
  const normalized = normalizeContactRole(role);
  if (!normalized) return '—';
  if (normalized in CONTACT_ROLE_LABELS) {
    return CONTACT_ROLE_LABELS[normalized as ContactRolePreset];
  }
  return role!.trim();
}

export function composeContactFullName(input: {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
}): string {
  const composed = [input.firstName, input.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ')
    .trim();
  if (composed) return composed;
  return input.fullName?.trim() || '';
}
