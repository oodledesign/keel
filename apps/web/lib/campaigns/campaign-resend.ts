const FOLLOW_UP_SUFFIX = ' (follow-up)';

export function normalizeResendEmail(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

export function uniqueRecipientEmails(
  recipients: Array<{ email: string }>,
): string[] {
  const emails = new Set<string>();
  for (const row of recipients) {
    const email = normalizeResendEmail(row.email);
    if (email) emails.add(email);
  }
  return [...emails];
}

export function nonResponderEmails(
  recipients: Array<{ email: string }>,
  submissions: Array<{ contactEmail: string | null }>,
): string[] {
  const responded = new Set(
    submissions
      .map((row) => normalizeResendEmail(row.contactEmail))
      .filter(Boolean),
  );
  return uniqueRecipientEmails(recipients).filter(
    (email) => !responded.has(email),
  );
}

export function followUpCampaignName(sourceName: string): string {
  const base = sourceName.trim() || 'Campaign';
  const raw = `${base}${FOLLOW_UP_SUFFIX}`;
  if (raw.length <= 160) return raw;
  const keep = 160 - FOLLOW_UP_SUFFIX.length;
  return `${base.slice(0, Math.max(1, keep)).trimEnd()}${FOLLOW_UP_SUFFIX}`;
}
