/**
 * Immutable contract version snapshots: canonical content hashing and
 * stale-version checks used by send/sign/portal.
 *
 * No `server-only` and no Supabase, so the service layer and unit tests
 * share one rule: a recipient can only sign the frozen version that was
 * actually sent. `node:crypto` is available in vitest's node environment
 * and in Next server code; this module is not imported from client components.
 */

import { createHash } from 'node:crypto';

export const CONTRACT_VERSION_STATUSES = [
  'draft',
  'sent',
  'signed',
  'superseded',
] as const;

export type ContractVersionStatus = (typeof CONTRACT_VERSION_STATUSES)[number];

export interface ContractVersionSnapshotInput {
  title?: string | null;
  content_html?: string | null;
  total_pence?: number | null;
  currency?: string | null;
  payment_plan?: unknown;
  author_type?: string | null;
  author_name?: string | null;
  author_company?: string | null;
  recipient_type?: string | null;
  recipient_name?: string | null;
  recipient_company?: string | null;
  recipient_email?: string | null;
}

export interface CanonicalPaymentPlanItem {
  label: string;
  percent: number;
}

export interface CanonicalVersionSnapshot {
  title: string;
  content_html: string;
  total_pence: number;
  currency: string;
  payment_plan: CanonicalPaymentPlanItem[];
  author_type: string;
  author_name: string;
  author_company: string;
  recipient_type: string;
  recipient_name: string;
  recipient_company: string;
  recipient_email: string;
}

function normalizePaymentPlan(raw: unknown): CanonicalPaymentPlanItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (item == null || typeof item !== 'object') return [];
    const label = (item as { label?: unknown }).label;
    const percent = (item as { percent?: unknown }).percent;
    if (typeof label !== 'string' || typeof percent !== 'number') return [];
    return [{ label, percent }];
  });
}

/** Stable, order-independent snapshot used as the hash input. */
export function canonicalizeVersionSnapshot(
  input: ContractVersionSnapshotInput,
): CanonicalVersionSnapshot {
  return {
    title: input.title?.trim() || 'Agreement',
    content_html: input.content_html ?? '',
    total_pence: Number.isFinite(input.total_pence) ? Number(input.total_pence) : 0,
    currency: (input.currency ?? 'gbp').trim().toLowerCase() || 'gbp',
    payment_plan: normalizePaymentPlan(input.payment_plan),
    author_type: input.author_type ?? '',
    author_name: input.author_name ?? '',
    author_company: input.author_company ?? '',
    recipient_type: input.recipient_type ?? '',
    recipient_name: input.recipient_name ?? '',
    recipient_company: input.recipient_company ?? '',
    recipient_email: input.recipient_email ?? '',
  };
}

/**
 * Hex SHA-256 of the canonical snapshot. Node's crypto is available in the
 * vitest node environment and in Next server code; this helper is not
 * imported from client components.
 */
export function hashVersionSnapshot(input: ContractVersionSnapshotInput): string {
  const canonical = canonicalizeVersionSnapshot(input);
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export type StaleVersionReason =
  | 'missing_version'
  | 'version_mismatch'
  | 'content_mismatch'
  | 'superseded'
  | 'not_frozen';

export interface StaleVersionCheckInput {
  /** Version the portal/client thinks it is signing. */
  providedVersionId?: string | null;
  /** Content hash the portal/client loaded with the document. */
  providedContentHash?: string | null;
  /** Frozen version currently offered for signing. */
  expectedVersionId?: string | null;
  expectedContentHash?: string | null;
  expectedVersionStatus?: string | null;
}

export interface StaleVersionCheckResult {
  ok: boolean;
  reason: StaleVersionReason | null;
}

/**
 * Reject signing (or any mutation of a frozen snapshot) when the client is
 * holding a stale version id, a stale content hash, or a superseded row.
 *
 * When a sent version exists, both version id and content hash are required
 * from the client — omitting them is treated as stale, not as a bypass.
 */
export function checkFrozenVersionMatch(
  input: StaleVersionCheckInput,
): StaleVersionCheckResult {
  if (!input.expectedVersionId || !input.expectedContentHash) {
    return { ok: false, reason: 'missing_version' };
  }

  const status = input.expectedVersionStatus ?? '';
  if (status === 'superseded') {
    return { ok: false, reason: 'superseded' };
  }
  if (status === 'draft') {
    return { ok: false, reason: 'not_frozen' };
  }

  if (
    !input.providedVersionId ||
    input.providedVersionId !== input.expectedVersionId
  ) {
    return { ok: false, reason: 'version_mismatch' };
  }

  if (
    !input.providedContentHash ||
    input.providedContentHash !== input.expectedContentHash
  ) {
    return { ok: false, reason: 'content_mismatch' };
  }

  return { ok: true, reason: null };
}

export function staleVersionErrorMessage(reason: StaleVersionReason | null): string {
  switch (reason) {
    case 'superseded':
      return 'This version has been replaced. Refresh to view the current agreement.';
    case 'version_mismatch':
    case 'content_mismatch':
      return 'This copy of the agreement is out of date. Refresh the page and try again.';
    case 'not_frozen':
      return 'This version has not been sent yet and cannot be signed.';
    case 'missing_version':
      return 'No frozen version is available to sign.';
    default:
      return 'This agreement cannot be signed.';
  }
}

/** Overlay a frozen version's body/terms/parties onto a contract row. */
export function overlayContractVersion<T extends Record<string, unknown>>(
  contract: T,
  version: ContractVersionSnapshotInput & {
    id?: string;
    version_number?: number | null;
    content_hash?: string | null;
    status?: string | null;
  } | null,
): T & {
  version_id: string | null;
  version_number: number | null;
  content_hash: string | null;
  version_status: string | null;
} {
  if (!version) {
    return {
      ...contract,
      version_id: null,
      version_number: null,
      content_hash: null,
      version_status: null,
    };
  }

  return {
    ...contract,
    title: version.title ?? contract['title'],
    content_html: version.content_html ?? contract['content_html'],
    total_pence: version.total_pence ?? contract['total_pence'],
    currency: version.currency ?? contract['currency'],
    payment_plan: version.payment_plan ?? contract['payment_plan'],
    author_type: version.author_type ?? contract['author_type'],
    author_name: version.author_name ?? contract['author_name'],
    author_company: version.author_company ?? contract['author_company'],
    recipient_type: version.recipient_type ?? contract['recipient_type'],
    recipient_name: version.recipient_name ?? contract['recipient_name'],
    recipient_company: version.recipient_company ?? contract['recipient_company'],
    recipient_email: version.recipient_email ?? contract['recipient_email'],
    version_id: version.id ?? null,
    version_number:
      typeof version.version_number === 'number' ? version.version_number : null,
    content_hash: version.content_hash ?? null,
    version_status: version.status ?? null,
  };
}

export function isFrozenVersionStatus(status: string | null | undefined): boolean {
  return status === 'sent' || status === 'signed';
}
