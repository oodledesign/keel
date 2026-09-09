/**
 * Client-safe campaign audience types and helpers (no server-only imports).
 */
import { z } from 'zod';

export const CAMPAIGN_AUDIENCE_TYPES = [
  'subscribers',
  'clients',
  'contacts',
  'custom',
  'list',
] as const;

export type CampaignAudienceType = (typeof CAMPAIGN_AUDIENCE_TYPES)[number];

export const CampaignAudienceConfigSchema = z.object({
  emails: z.array(z.string().email().max(320)).max(500).optional(),
  clientIds: z.array(z.string().uuid()).max(500).optional(),
  contactIds: z.array(z.string().uuid()).max(500).optional(),
  listId: z.string().uuid().optional().nullable(),
});

export type CampaignAudienceConfig = z.infer<
  typeof CampaignAudienceConfigSchema
>;

export const AUDIENCE_TYPE_LABEL: Record<CampaignAudienceType, string> = {
  subscribers: 'Subscribers',
  clients: 'Clients',
  contacts: 'Contacts',
  custom: 'Custom',
  list: 'Saved list',
};

export const AUDIENCE_TYPE_HINT: Record<CampaignAudienceType, string> = {
  subscribers: 'People who opted in via your mailing-list forms.',
  clients: 'Workspace clients with an email address on file.',
  contacts: 'First-class CRM contacts with an email address.',
  custom: 'Manual emails plus selected clients and contacts.',
  list: 'A named Growth list — logic filters or a manual contact list — resolved at send time.',
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
    return { emails: [], clientIds: [], contactIds: [], listId: null };
  }
  return {
    emails: parsed.data.emails ?? [],
    clientIds: parsed.data.clientIds ?? [],
    contactIds: parsed.data.contactIds ?? [],
    listId: parsed.data.listId ?? null,
  };
}

/** Drafts may store `list` with no listId yet. Block only at send/schedule. */
export const CAMPAIGN_AUDIENCE_LIST_REQUIRED =
  'Pick a list (or create one) before sending';

export function campaignAudienceListMissing(
  audienceType: CampaignAudienceType | string,
  audienceConfig: CampaignAudienceConfig | unknown,
): boolean {
  return (
    parseCampaignAudienceType(audienceType) === 'list' &&
    !parseCampaignAudienceConfig(audienceConfig).listId
  );
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
