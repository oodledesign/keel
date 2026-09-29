import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createHash, randomBytes, timingSafeEqual } from 'crypto';

import { createSesMailer } from '@kit/ses';
import { insertPlatformEmailLog } from '@kit/supabase/platform-email-log';

import {
  type CirculationConsentStatus,
  normalizeCirculationEmail,
} from '~/lib/commercial/circulation/circulation-eligibility';

const PURPOSE = 'matching_disposals' as const;
const CONSENT_COPY_VERSION = 'v1';

export type MarketingStatus = 'subscribed' | 'unsubscribed' | 'suppressed';
export type UnsubscribeSource =
  | 'one_click'
  | 'confirm_page'
  | 'preferences_page';

export type CirculationSettings = {
  account_id: string;
  auto_send_enabled: boolean;
  min_gap_days: number;
  rematch_on_price_drop: boolean;
  rematch_on_relist: boolean;
};

export const DEFAULT_CIRCULATION_MIN_GAP_DAYS = 5;

/** Unsubscribes this soon after a send, with no other engagement, look like link scanners. */
const SCANNER_UNSUBSCRIBE_WINDOW_MS = 2 * 60 * 1000;

export type SuspectedScannerUnsubscribe = {
  email: string;
  unsubscribedAt: string;
  sentAt: string;
  secondsAfterSend: number;
  publicAccessToken: string | null;
};
export type LawfulBasis =
  | 'website_requirement_form'
  | 'imported_historical'
  | 'manual_opt_in'
  | 'legitimate_interests'
  | 'other';

export type CirculationPreferenceRow = {
  email: string;
  marketingStatus: MarketingStatus;
  autoSendEnabled: boolean;
  lastDigestFingerprint: string | null;
  lastDigestSentAt: string | null;
  publicAccessToken: string | null;
};

/** Send-state lives apart from consent, so it exists for contacts with no preference row. */
export const CIRCULATION_CONTACT_STATE_TABLE =
  'commercial_circulation_contact_state';

/** Keeps `.in('email', …)` filters well under PostgREST URL limits. */
const EMAIL_IN_CHUNK = 150;

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function toCirculationSettings(row: {
  account_id: string;
  auto_send_enabled?: boolean | null;
  min_gap_days?: number | null;
  rematch_on_price_drop?: boolean | null;
  rematch_on_relist?: boolean | null;
}): CirculationSettings {
  return {
    account_id: row.account_id,
    auto_send_enabled: row.auto_send_enabled !== false,
    min_gap_days: row.min_gap_days ?? DEFAULT_CIRCULATION_MIN_GAP_DAYS,
    rematch_on_price_drop: row.rematch_on_price_drop === true,
    rematch_on_relist: row.rematch_on_relist === true,
  };
}

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

export const CIRCULATION_UNSUBSCRIBE_PAGE_PATH = '/unsubscribe/circulation';
export const CIRCULATION_ONE_CLICK_UNSUBSCRIBE_PATH =
  '/api/circulation/unsubscribe';

/**
 * pageUrl is the in-body link (GET shows a confirm button, no side effects).
 * oneClickUrl is the List-Unsubscribe header target (RFC 8058 POST).
 */
export function buildCirculationUnsubscribeUrls(input: {
  accountId: string;
  email: string;
  siteUrl: string;
}): { pageUrl: string; oneClickUrl: string } {
  const token = encodeURIComponent(
    createCirculationUnsubscribeToken({
      accountId: input.accountId,
      email: input.email,
    }),
  );
  return {
    pageUrl: new URL(
      `${CIRCULATION_UNSUBSCRIBE_PAGE_PATH}?token=${token}`,
      input.siteUrl,
    ).toString(),
    oneClickUrl: new URL(
      `${CIRCULATION_ONE_CLICK_UNSUBSCRIBE_PATH}?token=${token}`,
      input.siteUrl,
    ).toString(),
  };
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

  /**
   * Idempotent. Creates an unsubscribed row when none exists, because manual
   * sends can reach contacts with no preference row yet.
   */
  async unsubscribe(
    accountId: string,
    email: string,
    options?: { source?: UnsubscribeSource },
  ) {
    const normalized = normalizeEmail(email);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.client as any;

    const { data: existing, error: loadError } = await db
      .from('commercial_marketing_preferences')
      .select('id, marketing_status')
      .eq('account_id', accountId)
      .eq('email', normalized)
      .eq('purpose', PURPOSE)
      .maybeSingle();

    if (loadError) throw new Error(loadError.message);

    if (existing) {
      if (
        existing.marketing_status === 'suppressed' ||
        existing.marketing_status === 'unsubscribed'
      ) {
        return;
      }

      const { error } = await db
        .from('commercial_marketing_preferences')
        .update({
          marketing_status: 'unsubscribed',
          unsubscribed_at: new Date().toISOString(),
          unsubscribe_source: options?.source ?? null,
          unsubscribe_reviewed_at: null,
        })
        .eq('id', existing.id);

      if (error) throw new Error(error.message);
      return;
    }

    const { error } = await db.from('commercial_marketing_preferences').insert({
      account_id: accountId,
      email: normalized,
      purpose: PURPOSE,
      marketing_status: 'unsubscribed',
      lawful_basis: 'other',
      unsubscribed_at: new Date().toISOString(),
      unsubscribe_source: options?.source ?? null,
    });

    if (error && error.code !== '23505') throw new Error(error.message);
  }

  async getMarketingStatus(
    accountId: string,
    email: string,
  ): Promise<MarketingStatus | null> {
    const statuses = await this.getPreferenceStatuses(accountId, [email]);
    const status = statuses.get(normalizeEmail(email));
    return status === 'subscribed' ||
      status === 'unsubscribed' ||
      status === 'suppressed'
      ? status
      : null;
  }

  /**
   * Reverse an unsubscribe pause for matching_disposals.
   * Leaves bounce/complaint suppressions untouched. No-op when no row exists.
   */
  async resubscribe(
    accountId: string,
    email: string,
    options?: { consentSource?: string },
  ) {
    const normalized = normalizeEmail(email);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.client as any;

    const { data: existing } = await db
      .from('commercial_marketing_preferences')
      .select('id, marketing_status')
      .eq('account_id', accountId)
      .eq('email', normalized)
      .eq('purpose', PURPOSE)
      .maybeSingle();

    if (!existing || existing.marketing_status !== 'unsubscribed') {
      return;
    }

    const patch: Record<string, unknown> = {
      marketing_status: 'subscribed',
      unsubscribed_at: null,
      unsubscribe_source: null,
      unsubscribe_reviewed_at: null,
      consented_at: new Date().toISOString(),
    };
    if (options?.consentSource) {
      patch.consent_source = options.consentSource;
    }

    const { error } = await db
      .from('commercial_marketing_preferences')
      .update(patch)
      .eq('id', existing.id);

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
    const rows: Array<{ email: string; marketing_status: string }> = [];
    for (const chunk of chunkArray(normalized, EMAIL_IN_CHUNK)) {
      const { data, error } = await db
        .from('commercial_marketing_preferences')
        .select('email, marketing_status')
        .eq('account_id', accountId)
        .eq('purpose', PURPOSE)
        .in('email', chunk);

      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
    }

    for (const row of rows) {
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
  ): Promise<Map<string, CirculationPreferenceRow>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.client as any;
    const select =
      'email, marketing_status, auto_send_enabled, last_digest_fingerprint, last_digest_sent_at, public_access_token';

    const baseQuery = () =>
      db
        .from('commercial_marketing_preferences')
        .select(select)
        .eq('account_id', accountId)
        .eq('purpose', PURPOSE);

    const rows: Array<{
      email: string;
      marketing_status: string;
      auto_send_enabled?: boolean | null;
      last_digest_fingerprint?: string | null;
      last_digest_sent_at?: string | null;
      public_access_token?: string | null;
    }> = [];

    if (emails && emails.length > 0) {
      const normalized = [
        ...new Set(emails.map(normalizeEmail).filter(Boolean)),
      ];
      for (const chunk of chunkArray(normalized, EMAIL_IN_CHUNK)) {
        const { data, error } = await baseQuery().in('email', chunk);
        if (error) throw new Error(error.message);
        rows.push(...(data ?? []));
      }
    } else {
      const { data, error } = await baseQuery();
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
    }

    const map = new Map<string, CirculationPreferenceRow>();

    for (const row of rows) {
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

  /** When each contact was last emailed. Contacts never emailed are absent. */
  async listLastCirculatedAt(
    accountId: string,
    emails: string[],
  ): Promise<Map<string, string>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.client as any;
    const normalized = [...new Set(emails.map(normalizeEmail).filter(Boolean))];
    const map = new Map<string, string>();

    for (const chunk of chunkArray(normalized, EMAIL_IN_CHUNK)) {
      const { data, error } = await db
        .from(CIRCULATION_CONTACT_STATE_TABLE)
        .select('email, last_circulated_at')
        .eq('account_id', accountId)
        .in('email', chunk)
        .not('last_circulated_at', 'is', null);

      if (error) throw new Error(error.message);
      for (const row of (data ?? []) as Array<{
        email: string;
        last_circulated_at: string;
      }>) {
        map.set(normalizeEmail(row.email), row.last_circulated_at);
      }
    }

    return map;
  }

  async getOrCreateSettings(accountId: string): Promise<CirculationSettings> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.client as any;
    const { data: existing, error } = await db
      .from('commercial_circulation_settings')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (existing) return toCirculationSettings(existing);

    const { data, error: insertError } = await db
      .from('commercial_circulation_settings')
      .insert({ account_id: accountId, auto_send_enabled: true })
      .select('*')
      .single();

    if (insertError) throw new Error(insertError.message);
    return toCirculationSettings(data);
  }

  async setAutoSendEnabled(
    accountId: string,
    enabled: boolean,
  ): Promise<CirculationSettings> {
    return this.updateSettings(accountId, { auto_send_enabled: enabled });
  }

  async setMinGapDays(
    accountId: string,
    minGapDays: number,
  ): Promise<CirculationSettings> {
    return this.updateSettings(accountId, { min_gap_days: minGapDays });
  }

  async setRematchOptions(
    accountId: string,
    options: { onPriceDrop?: boolean; onRelist?: boolean },
  ): Promise<CirculationSettings> {
    return this.updateSettings(accountId, {
      ...(options.onPriceDrop !== undefined
        ? { rematch_on_price_drop: options.onPriceDrop }
        : {}),
      ...(options.onRelist !== undefined
        ? { rematch_on_relist: options.onRelist }
        : {}),
    });
  }

  private async updateSettings(
    accountId: string,
    patch: Partial<Omit<CirculationSettings, 'account_id'>>,
  ): Promise<CirculationSettings> {
    await this.getOrCreateSettings(accountId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.client as any;
    const { data, error } = await db
      .from('commercial_circulation_settings')
      .update(patch)
      .eq('account_id', accountId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return toCirculationSettings(data);
  }

  /**
   * Legacy link unsubscribes (GET, before confirm-first) that landed within
   * seconds of a send, from contacts with no engagement on any other email.
   */
  async listSuspectedScannerUnsubscribes(
    accountId: string,
  ): Promise<SuspectedScannerUnsubscribe[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.client as any;
    const { data: prefs, error } = await db
      .from('commercial_marketing_preferences')
      .select('email, unsubscribed_at, public_access_token')
      .eq('account_id', accountId)
      .eq('purpose', PURPOSE)
      .eq('marketing_status', 'unsubscribed')
      .is('unsubscribe_source', null)
      .is('unsubscribe_reviewed_at', null)
      .not('unsubscribed_at', 'is', null)
      .order('unsubscribed_at', { ascending: false })
      .limit(500);

    if (error) throw new Error(error.message);

    const prefRows = (prefs ?? []) as Array<{
      email: string;
      unsubscribed_at: string;
      public_access_token: string | null;
    }>;
    if (prefRows.length === 0) return [];

    const recipients: Array<{
      id: string;
      email: string;
      created_at: string;
      open_count: number | null;
      click_count: number | null;
    }> = [];
    for (const chunk of chunkArray(
      prefRows.map((row) => normalizeEmail(row.email)),
      EMAIL_IN_CHUNK,
    )) {
      const { data, error: recipientError } = await db
        .from('commercial_circulation_recipients')
        .select('id, email, created_at, open_count, click_count')
        .eq('account_id', accountId)
        .eq('status', 'sent')
        .in('email', chunk);
      if (recipientError) throw new Error(recipientError.message);
      recipients.push(...(data ?? []));
    }

    const byEmail = new Map<string, typeof recipients>();
    for (const row of recipients) {
      const email = normalizeEmail(row.email);
      const list = byEmail.get(email) ?? [];
      list.push(row);
      byEmail.set(email, list);
    }

    const flagged: SuspectedScannerUnsubscribe[] = [];
    for (const pref of prefRows) {
      const email = normalizeEmail(pref.email);
      const unsubscribedMs = Date.parse(pref.unsubscribed_at);
      const sends = byEmail.get(email) ?? [];

      const trigger = sends
        .filter((row) => {
          const sentMs = Date.parse(row.created_at);
          return (
            sentMs <= unsubscribedMs &&
            unsubscribedMs - sentMs <= SCANNER_UNSUBSCRIBE_WINDOW_MS
          );
        })
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
      if (!trigger) continue;

      const engagedElsewhere = sends.some(
        (row) =>
          row.id !== trigger.id &&
          ((row.open_count ?? 0) > 0 || (row.click_count ?? 0) > 0),
      );
      if (engagedElsewhere) continue;

      flagged.push({
        email,
        unsubscribedAt: pref.unsubscribed_at,
        sentAt: trigger.created_at,
        secondsAfterSend: Math.max(
          0,
          Math.round((unsubscribedMs - Date.parse(trigger.created_at)) / 1000),
        ),
        publicAccessToken: pref.public_access_token,
      });
    }

    return flagged;
  }

  async dismissUnsubscribeReview(accountId: string, email: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.client as any;
    const { error } = await db
      .from('commercial_marketing_preferences')
      .update({ unsubscribe_reviewed_at: new Date().toISOString() })
      .eq('account_id', accountId)
      .eq('email', normalizeEmail(email))
      .eq('purpose', PURPOSE)
      .eq('marketing_status', 'unsubscribed');

    if (error) throw new Error(error.message);
  }

  /**
   * Pause/resume auto-send for a contact. Enabling someone who is not yet
   * subscribed creates a preference with lawful_basis = manual_opt_in
   * (agent attestation from the Circulation UI). Never re-opts unsubscribed
   * or suppressed addresses.
   */
  async setContactAutoSend(input: {
    accountId: string;
    email: string;
    enabled: boolean;
  }) {
    const email = normalizeEmail(input.email);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.client as any;

    const { data: existing, error: loadError } = await db
      .from('commercial_marketing_preferences')
      .select('id, marketing_status')
      .eq('account_id', input.accountId)
      .eq('email', email)
      .eq('purpose', PURPOSE)
      .maybeSingle();

    if (loadError) throw new Error(loadError.message);

    const status = existing?.marketing_status as string | undefined;

    if (status === 'unsubscribed' || status === 'suppressed') {
      throw new Error(
        status === 'unsubscribed'
          ? 'This address unsubscribed — they cannot be re-enabled from here'
          : 'This address is suppressed and cannot receive circulation',
      );
    }

    if (!input.enabled) {
      if (!existing) return;
      const { error } = await db
        .from('commercial_marketing_preferences')
        .update({ auto_send_enabled: false })
        .eq('id', existing.id);
      if (error) throw new Error(error.message);
      return;
    }

    if (existing && status === 'subscribed') {
      const { error } = await db
        .from('commercial_marketing_preferences')
        .update({ auto_send_enabled: true })
        .eq('id', existing.id);
      if (error) throw new Error(error.message);
      return;
    }

    // Existing row that is not subscribed/unsubscribed/suppressed (e.g. legacy
    // status) — agent opt-in promotes to subscribed with manual_opt_in.
    if (existing) {
      const { error } = await db
        .from('commercial_marketing_preferences')
        .update({
          marketing_status: 'subscribed',
          lawful_basis: 'manual_opt_in',
          consent_source: 'agent_circulation_ui',
          consent_copy_version: CONSENT_COPY_VERSION,
          consented_at: new Date().toISOString(),
          auto_send_enabled: true,
          unsubscribed_at: null,
        })
        .eq('id', existing.id);
      if (error) throw new Error(error.message);
      return;
    }

    const { error } = await db.from('commercial_marketing_preferences').insert({
      account_id: input.accountId,
      email,
      purpose: PURPOSE,
      marketing_status: 'subscribed',
      lawful_basis: 'manual_opt_in',
      consent_source: 'agent_circulation_ui',
      consent_copy_version: CONSENT_COPY_VERSION,
      consented_at: new Date().toISOString(),
      auto_send_enabled: true,
    });
    if (error) throw new Error(error.message);
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

  /**
   * Atomically claims a contact for one send. False when another run holds a
   * fresh claim, or (when notCirculatedSince is set) they were emailed since.
   */
  async claimContactForSend(input: {
    accountId: string;
    email: string;
    notCirculatedSince?: Date | null;
  }): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.client as any;
    const { data, error } = await db.rpc(
      'claim_commercial_circulation_contact',
      {
        p_account_id: input.accountId,
        p_email: normalizeEmail(input.email),
        p_not_circulated_since: input.notCirculatedSince?.toISOString() ?? null,
      },
    );

    if (error) throw new Error(error.message);
    return data === true;
  }

  async releaseContactClaim(accountId: string, email: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.client as any;
    const { error } = await db
      .from(CIRCULATION_CONTACT_STATE_TABLE)
      .update({
        circulation_claimed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('account_id', accountId)
      .eq('email', normalizeEmail(email));

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
      await this.unsubscribe(input.accountId, email, {
        source: 'preferences_page',
      });
    } else if (input.unsubscribed === false) {
      await this.resubscribe(input.accountId, email);
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
      htmlBody: input.html,
    });
  }

  return { messageId };
}

export { PURPOSE as CIRCULATION_PURPOSE, CONSENT_COPY_VERSION };
export { buildCirculationEmailHtml } from './circulation-email';
