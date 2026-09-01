import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createHash, randomBytes, timingSafeEqual } from 'crypto';

import { createSesMailer } from '@kit/ses';

import {
  type CirculationConsentStatus,
  normalizeCirculationEmail,
} from '~/lib/commercial/circulation/circulation-eligibility';

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
  return normalizeCirculationEmail(email);
}

function getUnsubscribeSecret(): string {
  const secret = process.env.CIRCULATION_UNSUBSCRIBE_SECRET?.trim();
  if (secret) return secret;

  // Local/dev only — never ship production without an explicit secret.
  if (process.env.NODE_ENV !== 'production') {
    return 'circulation-dev-secret';
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
    if (
      sig.length !== expected.length ||
      !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
      return null;
    }
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

  async getPreferenceStatuses(
    accountId: string,
    emails: string[],
  ): Promise<Map<string, CirculationConsentStatus>> {
    const normalized = [...new Set(emails.map(normalizeEmail).filter(Boolean))];
    const map = new Map<string, CirculationConsentStatus>();
    if (normalized.length === 0) return map;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.client as any;
    const { data, error } = await db
      .from('commercial_marketing_preferences')
      .select('email, marketing_status')
      .eq('account_id', accountId)
      .eq('purpose', PURPOSE)
      .in('email', normalized);

    if (error) throw new Error(error.message);

    for (const row of (data ?? []) as Array<{
      email: string;
      marketing_status: string;
    }>) {
      const status = row.marketing_status;
      if (
        status === 'subscribed' ||
        status === 'unsubscribed' ||
        status === 'suppressed'
      ) {
        map.set(normalizeEmail(row.email), status);
      }
    }

    return map;
  }

  async getSubscribedEmails(
    accountId: string,
    emails: string[],
  ): Promise<Set<string>> {
    const statuses = await this.getPreferenceStatuses(accountId, emails);
    return new Set(
      [...statuses.entries()]
        .filter(([, status]) => status === 'subscribed')
        .map(([email]) => email),
    );
  }

  async listPreferences(
    accountId: string,
    emails?: string[],
  ): Promise<
    Map<
      string,
      {
        email: string;
        marketingStatus: MarketingStatus;
        autoSendEnabled: boolean;
        lastDigestFingerprint: string | null;
        lastDigestSentAt: string | null;
        publicAccessToken: string | null;
      }
    >
  > {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.client as any;
    let query = db
      .from('commercial_marketing_preferences')
      .select(
        'email, marketing_status, auto_send_enabled, last_digest_fingerprint, last_digest_sent_at, public_access_token',
      )
      .eq('account_id', accountId)
      .eq('purpose', PURPOSE);

    if (emails && emails.length > 0) {
      query = query.in('email', [
        ...new Set(emails.map(normalizeEmail).filter(Boolean)),
      ]);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const map = new Map<
      string,
      {
        email: string;
        marketingStatus: MarketingStatus;
        autoSendEnabled: boolean;
        lastDigestFingerprint: string | null;
        lastDigestSentAt: string | null;
        publicAccessToken: string | null;
      }
    >();

    for (const row of (data ?? []) as Array<{
      email: string;
      marketing_status: string;
      auto_send_enabled?: boolean | null;
      last_digest_fingerprint?: string | null;
      last_digest_sent_at?: string | null;
      public_access_token?: string | null;
    }>) {
      const status = row.marketing_status;
      if (
        status !== 'subscribed' &&
        status !== 'unsubscribed' &&
        status !== 'suppressed'
      ) {
        continue;
      }
      const email = normalizeEmail(row.email);
      map.set(email, {
        email,
        marketingStatus: status,
        autoSendEnabled: row.auto_send_enabled !== false,
        lastDigestFingerprint: row.last_digest_fingerprint ?? null,
        lastDigestSentAt: row.last_digest_sent_at ?? null,
        publicAccessToken: row.public_access_token ?? null,
      });
    }

    return map;
  }

  async getOrCreateSettings(accountId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.client as any;
    const { data: existing, error } = await db
      .from('commercial_circulation_settings')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (existing) {
      return existing as { account_id: string; auto_send_enabled: boolean };
    }

    const { data, error: insertError } = await db
      .from('commercial_circulation_settings')
      .insert({ account_id: accountId, auto_send_enabled: true })
      .select('*')
      .single();

    if (insertError) throw new Error(insertError.message);
    return data as { account_id: string; auto_send_enabled: boolean };
  }

  async setAutoSendEnabled(accountId: string, enabled: boolean) {
    await this.getOrCreateSettings(accountId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.client as any;
    const { data, error } = await db
      .from('commercial_circulation_settings')
      .update({ auto_send_enabled: enabled })
      .eq('account_id', accountId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as { account_id: string; auto_send_enabled: boolean };
  }

  async setContactAutoSend(input: {
    accountId: string;
    email: string;
    enabled: boolean;
  }) {
    const email = normalizeEmail(input.email);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.client as any;
    const { data, error } = await db
      .from('commercial_marketing_preferences')
      .update({ auto_send_enabled: input.enabled })
      .eq('account_id', input.accountId)
      .eq('email', email)
      .eq('purpose', PURPOSE)
      .select('id')
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) {
      throw new Error('No circulation preference found for that address');
    }
  }

  async ensurePublicAccessToken(accountId: string, email: string) {
    const normalized = normalizeEmail(email);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.client as any;
    const { data: existing, error } = await db
      .from('commercial_marketing_preferences')
      .select('id, public_access_token')
      .eq('account_id', accountId)
      .eq('email', normalized)
      .eq('purpose', PURPOSE)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!existing) return null;
    if (existing.public_access_token) {
      return existing.public_access_token as string;
    }

    const token = randomBytes(24).toString('hex');
    const { data, error: updateError } = await db
      .from('commercial_marketing_preferences')
      .update({ public_access_token: token })
      .eq('id', existing.id)
      .select('public_access_token')
      .single();

    if (updateError) throw new Error(updateError.message);
    return (data?.public_access_token as string | undefined) ?? token;
  }

  async recordDigestSent(input: {
    accountId: string;
    email: string;
    fingerprint: string;
  }) {
    const email = normalizeEmail(input.email);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.client as any;
    const { error } = await db
      .from('commercial_marketing_preferences')
      .update({
        last_digest_fingerprint: input.fingerprint,
        last_digest_sent_at: new Date().toISOString(),
      })
      .eq('account_id', input.accountId)
      .eq('email', email)
      .eq('purpose', PURPOSE);

    if (error) throw new Error(error.message);
  }

  async loadPreferenceByPublicToken(token: string) {
    const trimmed = token.trim();
    if (trimmed.length < 16) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.client as any;
    const { data, error } = await db
      .from('commercial_marketing_preferences')
      .select(
        'account_id, email, marketing_status, auto_send_enabled, public_access_token',
      )
      .eq('public_access_token', trimmed)
      .eq('purpose', PURPOSE)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    const status = data.marketing_status as MarketingStatus;
    return {
      accountId: data.account_id as string,
      email: normalizeEmail(String(data.email ?? '')),
      marketingStatus: status,
      autoSendEnabled: data.auto_send_enabled !== false,
      publicAccessToken: String(data.public_access_token ?? trimmed),
    };
  }

  async updatePublicPreference(input: {
    accountId: string;
    email: string;
    unsubscribed?: boolean;
    notifyOnNewMatch?: boolean;
  }) {
    const email = normalizeEmail(input.email);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.client as any;

    if (input.unsubscribed) {
      await this.unsubscribe(input.accountId, email);
    } else if (input.unsubscribed === false) {
      const { data: existing } = await db
        .from('commercial_marketing_preferences')
        .select('id, marketing_status')
        .eq('account_id', input.accountId)
        .eq('email', email)
        .eq('purpose', PURPOSE)
        .maybeSingle();

      if (existing && existing.marketing_status !== 'suppressed') {
        const { error } = await db
          .from('commercial_marketing_preferences')
          .update({
            marketing_status: 'subscribed',
            unsubscribed_at: null,
            consented_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        if (error) throw new Error(error.message);
      }
    }

    if (input.notifyOnNewMatch != null) {
      const { error } = await db
        .from('commercial_marketing_preferences')
        .update({ auto_send_enabled: input.notifyOnNewMatch })
        .eq('account_id', input.accountId)
        .eq('email', email)
        .eq('purpose', PURPOSE);
      if (error) throw new Error(error.message);
    }
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
  accountId?: string | null;
  sesTenant?: string;
  sesConfigurationSet?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ messageId: string | null }> {
  const { insertPlatformEmailLog } =
    await import('@kit/supabase/platform-email-log');

  let status: 'sent' | 'failed' = 'sent';
  let errorMessage: string | null = null;
  let messageId: string | null = null;

  try {
    const mailer = createSesMailer();
    const result = await mailer.sendEmail({
      to: input.to,
      from: input.from,
      subject: input.subject,
      html: input.html,
      replyTo: input.replyTo,
      listUnsubscribeUrl: input.listUnsubscribeUrl,
      sesTenant: input.sesTenant,
      sesConfigurationSet: input.sesConfigurationSet,
    });
    messageId =
      result &&
      typeof result === 'object' &&
      'messageId' in result &&
      typeof result.messageId === 'string'
        ? result.messageId
        : null;
  } catch (error) {
    status = 'failed';
    errorMessage = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    await insertPlatformEmailLog({
      emailType: 'commercial_circulation',
      accountId: input.accountId ?? null,
      recipientEmail: input.to,
      senderEmail: input.from,
      subject: input.subject,
      status,
      errorMessage,
      metadata: {
        provider: 'ses',
        ses_message_id: messageId,
        ...(input.metadata ?? {}),
      },
    });
  }

  return { messageId };
}

export { PURPOSE as CIRCULATION_PURPOSE, CONSENT_COPY_VERSION };
export { buildCirculationEmailHtml } from './circulation-email';
