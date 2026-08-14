export type EmailTriageAction = 'ignore' | 'priority';
export type EmailTriageScope = 'sender' | 'domain' | 'subject';

export type EmailTriageRules = {
  ignoredSenders: string[];
  ignoredDomains: string[];
  ignoredSubjectKeywords: string[];
  prioritySenders: string[];
  priorityDomains: string[];
  prioritySubjectKeywords: string[];
};

export type EmailTriageMatch = {
  action: EmailTriageAction;
  scope: EmailTriageScope;
  value: string;
  reason: string;
};

export function normalizeSubjectKeywords(
  values: Array<string | null | undefined> | null | undefined,
): string[] {
  const unique = new Set<string>();

  for (const value of values ?? []) {
    const trimmed = value?.trim().replace(/\s+/g, ' ');
    if (!trimmed || trimmed.length < 2) continue;
    unique.add(trimmed.slice(0, 200));
  }

  return [...unique].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
}

export function subjectKeywordFromThreadSubject(
  subject: string | null | undefined,
): string | null {
  if (!subject?.trim()) return null;

  const cleaned = subject
    .replace(/^\s*((re|fw|fwd)\s*:\s*)+/i, '')
    .trim()
    .replace(/\s+/g, ' ');

  if (cleaned.length < 3) return null;
  return cleaned.slice(0, 120);
}

export function subjectMatchesKeyword(
  subject: string | null | undefined,
  keywords: string[],
): string | null {
  if (!subject?.trim() || keywords.length === 0) return null;
  const haystack = subject.toLowerCase();

  for (const keyword of keywords) {
    const needle = keyword.trim().toLowerCase();
    if (needle.length >= 2 && haystack.includes(needle)) {
      return keyword;
    }
  }

  return null;
}

export function truncateSubjectLabel(
  subject: string | null | undefined,
  max = 36,
): string {
  const keyword = subjectKeywordFromThreadSubject(subject);
  if (!keyword) return 'this subject';
  if (keyword.length <= max) return `“${keyword}”`;
  return `“${keyword.slice(0, max - 1)}…”`;
}

export function triageRuleSuccessMessage(
  action: EmailTriageAction,
  scope: EmailTriageScope,
  value: string,
  affectedCount: number,
): string {
  const affected =
    affectedCount > 0
      ? ` Updated ${affectedCount} thread${affectedCount === 1 ? '' : 's'}.`
      : '';

  if (action === 'ignore') {
    if (scope === 'sender') return `Ignoring ${value}.${affected}`;
    if (scope === 'domain') return `Ignoring @${value}.${affected}`;
    return `Ignoring subjects containing “${value}”.${affected}`;
  }

  if (scope === 'sender') {
    return `Always needs reply from ${value}.${affected}`;
  }
  if (scope === 'domain') {
    return `Always needs reply from @${value}.${affected}`;
  }
  return `Always needs reply for subjects containing “${value}”.${affected}`;
}
