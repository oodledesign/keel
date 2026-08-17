import 'server-only';

import { createHash, randomBytes } from 'crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createSesMailer } from '@kit/ses';

import {
  escapeNotificationHtml,
  wrapNotificationEmail,
} from '~/lib/email/wrap-notification-email';

const PURPOSE = 'matching_disposals' as const;
const CONSENT_COPY_VERSION = 'v1';

export type MarketingStatus = 'subscribed' | 'unsubscribed' | 'suppressed';
export type LawfulBasis =
  | 'website_requirement_form'
  | 'imported_historical'
  | 'manual_opt_in'
  | 'legitimate_interests'
  | 'other';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getUnsubscribeSecret(): string {
  const secret = process.env.CIRCULATION_UNSUBSCRIBE_SECRET?.trim();
  if (secret) return secret;

  // Local/dev only — never ship production without an explicit secret.
  if (process.env.NODE_ENV !== 'production') {
    return (
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || 'circulation-dev-secret'
    );
  }

  throw new Error('CIRCULATION_UNSUBSCRIBE_SECRET is not configured');
}

export function createCirculationUnsubscribeToken(input: {
  accountId: string;
  email: string;
}): string {
  const secret = getUnsubscribeSecret();
  const email = normalizeEmail(input.email);
  const payload = `${input.accountId}:${email}`;
  const sig = createHash('sha256')
    .update(`${payload}:${secret}`)
    .digest('hex')
    .slice(0, 24);
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

export function decodeCirculationUnsubscribeToken(token: string): {
  accountId: string;
  email: string;
} | null {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const parts = raw.split(':');
    if (parts.length < 3) return null;
    const sig = parts.at(-1)!;
    const accountId = parts[0]!;
    const email = parts.slice(1, -1).join(':');
    if (!accountId || !email || !sig) return null;

    const secret = getUnsubscribeSecret();
    const payload = `${accountId}:${normalizeEmail(email)}`;
    const expected = createHash('sha256')
      .update(`${payload}:${secret}`)
      .digest('hex')
      .slice(0, 24);
    if (sig !== expected) return null;
    return { accountId, email: normalizeEmail(email) };
  } catch {
    return null;
  }
}

export function createCommercialCirculationService(client: SupabaseClient) {
  return new CommercialCirculationService(client);
}

class CommercialCirculationService {
  constructor(private readonly client: SupabaseClient) {}

  /**
   * Upsert preference for website form. Never re-subscribes unsubscribed/suppressed.
   */
  async ensureSubscribedPreference(input: {
    accountId: string;
    email: string;
    lawfulBasis: LawfulBasis;
    consentSource?: string;
    consentCopyVersion?: string;
    clientId?: string | null;
  }) {
    const email = normalizeEmail(input.email);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.client as any;

    const { data: existing } = await db
      .from('commercial_marketing_preferences')
      .select('*')
      .eq('account_id', input.accountId)
      .eq('email', email)
      .eq('purpose', PURPOSE)
      .maybeSingle();

    if (existing) {
      if (
        existing.marketing_status === 'unsubscribed' ||
        existing.marketing_status === 'suppressed'
      ) {
        return existing as Record<string, unknown>;
      }

      const { data, error } = await db
        .from('commercial_marketing_preferences')
        .update({
          lawful_basis: input.lawfulBasis,
          consent_source: input.consentSource ?? existing.consent_source,
          consent_copy_version:
            input.consentCopyVersion ?? existing.consent_copy_version,
          client_id: input.clientId ?? existing.client_id,
        })
        .eq('id', existing.id)
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return data as Record<string, unknown>;
    }

    const { data, error } = await db
      .from('commercial_marketing_preferences')
      .insert({
        account_id: input.accountId,
        email,
        purpose: PURPOSE,
        marketing_status: 'subscribed',
        lawful_basis: input.lawfulBasis,
        consent_source: input.consentSource ?? null,
        consent_copy_version: input.consentCopyVersion ?? CONSENT_COPY_VERSION,
        client_id: input.clientId ?? null,
        consented_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as Record<string, unknown>;
  }

  async unsubscribe(accountId: string, email: string) {
    const normalized = normalizeEmail(email);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.client as any;

    const { error } = await db
      .from('commercial_marketing_preferences')
      .update({
        marketing_status: 'unsubscribed',
        unsubscribed_at: new Date().toISOString(),
      })
      .eq('account_id', accountId)
      .eq('email', normalized)
      .eq('purpose', PURPOSE);

    if (error) throw new Error(error.message);
  }

  async isSubscribed(accountId: string, email: string): Promise<boolean> {
    const set = await this.getSubscribedEmails(accountId, [email]);
    return set.has(normalizeEmail(email));
  }

  async getSubscribedEmails(
    accountId: string,
    emails: string[],
  ): Promise<Set<string>> {
    const normalized = [
      ...new Set(emails.map(normalizeEmail).filter(Boolean)),
    ];
    if (normalized.length === 0) return new Set();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.client as any;
    const { data, error } = await db
      .from('commercial_marketing_preferences')
      .select('email')
      .eq('account_id', accountId)
      .eq('purpose', PURPOSE)
      .eq('marketing_status', 'subscribed')
      .in('email', normalized);

    if (error) throw new Error(error.message);

    return new Set(
      ((data ?? []) as Array<{ email: string }>).map((r) =>
        normalizeEmail(r.email),
      ),
    );
  }

  async getOrCreateRequirementForm(accountId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.client as any;
    const { data: existing } = await db
      .from('commercial_requirement_forms')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle();

    if (existing) return existing as Record<string, unknown>;

    const token = randomBytes(24).toString('hex');
    const { data, error } = await db
      .from('commercial_requirement_forms')
      .insert({
        account_id: accountId,
        share_token: token,
        enabled: false,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as Record<string, unknown>;
  }

  async updateRequirementForm(
    accountId: string,
    patch: {
      enabled?: boolean;
      privacyPolicyUrl?: string | null;
      successMessage?: string | null;
      title?: string;
      intro?: string | null;
    },
  ) {
    await this.getOrCreateRequirementForm(accountId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.client as any;
    const { data, error } = await db
      .from('commercial_requirement_forms')
      .update({
        ...(patch.enabled != null ? { enabled: patch.enabled } : {}),
        ...(patch.privacyPolicyUrl !== undefined
          ? { privacy_policy_url: patch.privacyPolicyUrl }
          : {}),
        ...(patch.successMessage !== undefined
          ? { success_message: patch.successMessage }
          : {}),
        ...(patch.title != null ? { title: patch.title } : {}),
        ...(patch.intro !== undefined ? { intro: patch.intro } : {}),
      })
      .eq('account_id', accountId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as Record<string, unknown>;
  }
}

export async function sendCirculationEmailViaSes(input: {
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  html: string;
  listUnsubscribeUrl: string;
}): Promise<void> {
  const mailer = createSesMailer();
  await mailer.sendEmail({
    to: input.to,
    from: input.from,
    subject: input.subject,
    html: input.html,
    replyTo: input.replyTo,
    listUnsubscribeUrl: input.listUnsubscribeUrl,
  });
}

export function buildCirculationEmailHtml(input: {
  agencyName: string;
  listingName: string;
  listingSummary: string;
  address: string;
  unsubscribeUrl: string;
  viewUrl?: string | null;
}): string {
  const body = `
    <p style="margin:0 0 12px;">${escapeNotificationHtml(input.agencyName)} thought this opportunity may match your registered requirement.</p>
    <p style="margin:0 0 8px;"><strong>${escapeNotificationHtml(input.listingName)}</strong></p>
    ${
      input.address
        ? `<p style="margin:0 0 8px;">${escapeNotificationHtml(input.address)}</p>`
        : ''
    }
    <p style="margin:0 0 16px;white-space:pre-wrap;">${escapeNotificationHtml(input.listingSummary)}</p>
    <p style="margin:0;font-size:12px;color:#666;">You are receiving this because you registered a commercial property requirement with ${escapeNotificationHtml(input.agencyName)}. <a href="${escapeNotificationHtml(input.unsubscribeUrl)}">Unsubscribe</a> from matching opportunity emails.</p>
  `;

  return wrapNotificationEmail(body, {
    productName: input.agencyName,
    title: input.listingName,
    heading: input.listingName,
    preview: `Matching opportunity: ${input.listingName}`,
    cta: input.viewUrl
      ? { label: 'View details', href: input.viewUrl }
      : undefined,
    footerNote: 'Matching commercial opportunities only — not a newsletter.',
  });
}

export { PURPOSE as CIRCULATION_PURPOSE, CONSENT_COPY_VERSION };
