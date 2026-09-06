/**
 * Client-safe v1 logic filters for saved audience lists (Growth+).
 */
import { z } from 'zod';

export const AUDIENCE_FILTER_FIELDS = [
  'email_domain',
  'email',
  'display_name',
  'subscribed_after',
  'created_after',
  'client_type',
  'has_company',
] as const;

export type AudienceFilterField = (typeof AUDIENCE_FILTER_FIELDS)[number];

export const AUDIENCE_FILTER_OPS = ['eq', 'contains', 'gte'] as const;

export type AudienceFilterOp = (typeof AUDIENCE_FILTER_OPS)[number];

export const AudienceFilterRuleSchema = z.object({
  field: z.enum(AUDIENCE_FILTER_FIELDS),
  op: z.enum(AUDIENCE_FILTER_OPS),
  value: z.string().trim().max(200),
});

export type AudienceFilterRule = z.infer<typeof AudienceFilterRuleSchema>;

export const AudienceListFiltersSchema = z.object({
  source: z.enum(['subscribers', 'clients', 'contacts']),
  matchMode: z.enum(['all', 'any']).default('all'),
  rules: z.array(AudienceFilterRuleSchema).max(12).default([]),
});

export type AudienceListFilters = z.infer<typeof AudienceListFiltersSchema>;

export const AUDIENCE_FILTER_FIELD_LABEL: Record<AudienceFilterField, string> =
  {
    email_domain: 'Email domain',
    email: 'Email contains',
    display_name: 'Name contains',
    subscribed_after: 'Subscribed after',
    created_after: 'Created after',
    client_type: 'Client type',
    has_company: 'Has company name',
  };

export const AUDIENCE_FILTER_OP_LABEL: Record<AudienceFilterOp, string> = {
  eq: 'is',
  contains: 'contains',
  gte: 'on or after',
};

export type AudienceFilterSubject = {
  email: string;
  displayName: string | null;
  consentedAt?: string | null;
  createdAt?: string | null;
  clientType?: string | null;
  companyName?: string | null;
};

function domainOf(email: string): string {
  const at = email.lastIndexOf('@');
  return at >= 0 ? email.slice(at + 1).toLowerCase() : '';
}

function matchesRule(
  subject: AudienceFilterSubject,
  rule: AudienceFilterRule,
): boolean {
  const value = rule.value.trim().toLowerCase();
  if (!value) return true;

  switch (rule.field) {
    case 'email_domain': {
      const domain = domainOf(subject.email);
      if (rule.op === 'eq') return domain === value;
      return domain.includes(value);
    }
    case 'email':
      return subject.email.toLowerCase().includes(value);
    case 'display_name':
      return (subject.displayName ?? '').toLowerCase().includes(value);
    case 'subscribed_after': {
      const at = subject.consentedAt ? Date.parse(subject.consentedAt) : NaN;
      const min = Date.parse(rule.value);
      return Number.isFinite(at) && Number.isFinite(min) && at >= min;
    }
    case 'created_after': {
      const at = subject.createdAt ? Date.parse(subject.createdAt) : NaN;
      const min = Date.parse(rule.value);
      return Number.isFinite(at) && Number.isFinite(min) && at >= min;
    }
    case 'client_type':
      return (subject.clientType ?? '').toLowerCase() === value;
    case 'has_company': {
      const has = Boolean(subject.companyName?.trim());
      if (value === 'false' || value === '0' || value === 'no') return !has;
      return has;
    }
    default:
      return true;
  }
}

export function applyAudienceFilters(
  subjects: AudienceFilterSubject[],
  filters: AudienceListFilters,
): AudienceFilterSubject[] {
  const rules = filters.rules.filter((rule) => rule.value.trim().length > 0);
  if (rules.length === 0) return subjects;

  return subjects.filter((subject) => {
    const hits = rules.map((rule) => matchesRule(subject, rule));
    return filters.matchMode === 'any'
      ? hits.some(Boolean)
      : hits.every(Boolean);
  });
}

export function parseAudienceListFilters(value: unknown): AudienceListFilters {
  const parsed = AudienceListFiltersSchema.safeParse(value ?? {});
  if (!parsed.success) {
    return { source: 'subscribers', matchMode: 'all', rules: [] };
  }
  return parsed.data;
}

export function emptyAudienceFilterRule(): AudienceFilterRule {
  return { field: 'email_domain', op: 'eq', value: '' };
}
