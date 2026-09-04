/**
 * Client-safe campaign audience types and helpers (no server-only imports).
 */

import { z } from 'zod';

export const CAMPAIGN_AUDIENCE_TYPES = [
  'subscribers',
  'clients',
  'contacts',
  'custom',
] as const;

export type CampaignAudienceType = (typeof CAMPAIGN_AUDIENCE_TYPES)[number];

export const CampaignAudienceConfigSchema = z.object({
  emails: z.array(z.string().email().max(320)).max(500).optional(),
  clientIds: z.array(z.string().uuid()).max(500).optional(),
  contactIds: z.array(z.string().uuid()).max(500).optional(),
});

export type CampaignAudienceConfig = z.infer<typeof CampaignAudienceConfigSchema>;

export const AUDIENCE_TYPE_LABEL: Record<CampaignAudienceType, string> = {
  subscribers: 'Subscribers',
  clients: 'Clients',
  contacts: 'Contacts',
  custom: 'Custom',
};

export const AUDIENCE_TYPE_HINT: Record<CampaignAudienceType, string> = {
  subscribers: 'People who opted in via your mailing-list forms.',
  clients: 'Workspace clients with an email address on file.',
  contacts: 'First-class CRM contacts with an email address.',
  custom: 'Manual emails plus selected clients and contacts.',
};

export function parseCampaignAudienceType(
  value: unknown,
): CampaignAudienceType {
  if (
    typeof value === 'string' &&
    (CAMPAIGN_AUDIENCE_TYPES as readonly string[]).includes(value)
  ) {
    return value as CampaignAudienceType;
  }
  return 'subscribers';
}

export function parseCampaignAudienceConfig(
  value: unknown,
): CampaignAudienceConfig {
  const parsed = CampaignAudienceConfigSchema.safeParse(value ?? {});
  if (!parsed.success) {
    return { emails: [], clientIds: [], contactIds: [] };
  }
  return {
    emails: parsed.data.emails ?? [],
    clientIds: parsed.data.clientIds ?? [],
    contactIds: parsed.data.contactIds ?? [],
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeAudienceEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of emails) {
    const email = raw.trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email) || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

export function parseAudienceEmailInput(text: string): string[] {
  return normalizeAudienceEmails(
    text.split(/[\s,;]+/).filter((part) => part.length > 0),
  );
}
