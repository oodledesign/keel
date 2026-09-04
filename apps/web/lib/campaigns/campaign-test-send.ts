/**
 * Client-safe helpers for campaign test sends (no server-only imports).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const CAMPAIGN_TEST_SUBJECT_PREFIX = '[Test]';

export const CAMPAIGN_TEST_MAX_RECIPIENTS = 20;

/** Dummy unsubscribe token — not a real mailing preference. */
export const CAMPAIGN_TEST_UNSUBSCRIBE_TOKEN = 'campaign-test-preview';

export function isValidCampaignTestEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/**
 * Trim, lowercase, drop empties/invalids, dedupe (first wins).
 */
export function normalizeCampaignTestEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of emails) {
    const email = raw.trim().toLowerCase();
    if (!email || !isValidCampaignTestEmail(email) || seen.has(email)) {
      continue;
    }
    seen.add(email);
    out.push(email);
  }

  return out;
}

/** Parse comma / whitespace / semicolon separated free-text into emails. */
export function parseCampaignTestEmailInput(text: string): string[] {
  return normalizeCampaignTestEmails(
    text.split(/[\s,;]+/).filter((part) => part.length > 0),
  );
}

export function campaignTestSubject(subject: string): string {
  const trimmed = subject.trim() || 'Untitled campaign';
  if (trimmed.toLowerCase().startsWith('[test]')) {
    return trimmed;
  }
  return `${CAMPAIGN_TEST_SUBJECT_PREFIX} ${trimmed}`;
}
