/**
 * Client-safe helpers for public form resume-later drafts.
 * Tokens and expiry live here so the public page and API share one contract.
 */
import pathsConfig from '~/config/paths.config';

import { isValidFormNotifyEmail, normalizeFormNotifyEmail } from './form-email';
import type { WorkspaceFormField } from './form-fields';
import { type PublicFormValues, parseFormFileValue } from './form-file';

export const FORM_DRAFT_TTL_DAYS = 30;
export const FORM_RESUME_QUERY_PARAM = 'resume';

const MAX_DRAFT_VALUE_LENGTH = 2000;

export function formDraftExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + FORM_DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function isFormDraftExpired(
  expiresAt: string | Date,
  now: Date = new Date(),
): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}

export function isLikelyResumeToken(value: string | null | undefined): boolean {
  return Boolean(value && value.length >= 16 && value.length <= 128);
}

export function sanitizeFormDraftValues(
  fields: WorkspaceFormField[],
  values: Record<string, unknown>,
): PublicFormValues {
  const allowed = new Map(fields.map((field) => [field.key, field]));
  const next: PublicFormValues = {};

  for (const [key, raw] of Object.entries(values)) {
    const field = allowed.get(key);
    if (!field) continue;
    if (field.type === 'file') {
      const file = parseFormFileValue(raw);
      if (file) next[key] = file;
      continue;
    }
    if (typeof raw === 'boolean') {
      next[key] = raw;
      continue;
    }
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      next[key] = String(raw).slice(0, MAX_DRAFT_VALUE_LENGTH);
      continue;
    }
    if (typeof raw !== 'string') continue;
    next[key] = raw.slice(0, MAX_DRAFT_VALUE_LENGTH);
  }

  return next;
}

export function resumeEmailFromValues(
  fields: WorkspaceFormField[],
  values: PublicFormValues,
): string | null {
  const emailField = fields.find(
    (field) => field.type === 'email' || field.key === 'email',
  );
  if (!emailField) return null;
  const raw = values[emailField.key];
  if (typeof raw !== 'string') return null;
  if (!isValidFormNotifyEmail(raw)) return null;
  return normalizeFormNotifyEmail(raw);
}

export function clampFormStepIndex(
  stepIndex: number,
  stepCount: number,
): number {
  if (!Number.isFinite(stepIndex) || stepCount <= 0) return 0;
  return Math.min(Math.max(0, Math.trunc(stepIndex)), stepCount - 1);
}

/**
 * Resume tokens are the credential (magic-link style). Anyone with the URL
 * can restore answers until the draft expires or the form is submitted.
 */
export function buildFormResumePath(input: {
  shareToken: string;
  resumeToken: string;
  embed?: boolean;
  listingId?: string | null;
  propertyId?: string | null;
}): string {
  const path = pathsConfig.app.formShare.replace(
    '[token]',
    input.shareToken.trim(),
  );
  const params = new URLSearchParams();
  params.set(FORM_RESUME_QUERY_PARAM, input.resumeToken.trim());
  if (input.embed) params.set('embed', '1');
  if (input.listingId?.trim()) params.set('listing', input.listingId.trim());
  if (input.propertyId?.trim()) params.set('property', input.propertyId.trim());
  return `${path}?${params.toString()}`;
}

export function buildFormResumeUrl(input: {
  shareToken: string;
  resumeToken: string;
  siteUrl?: string | null;
  embed?: boolean;
  listingId?: string | null;
  propertyId?: string | null;
}): string {
  const path = buildFormResumePath(input);
  const base = (
    input.siteUrl?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    'https://ozer.so'
  ).replace(/\/$/, '');
  return `${base}${path}`;
}
