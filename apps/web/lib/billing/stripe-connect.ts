import 'server-only';

import { createHmac, timingSafeEqual } from 'crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import { stripeConnectErrorMessage } from './stripe-connect-messages';

export { stripeConnectErrorMessage };

export type StripeKeyMode = 'test' | 'live';

type QueryResult<T> = PromiseLike<{
  data: T | null;
  error: { message: string } | null;
}>;

type QueryBuilder<T> = QueryResult<T> & {
  select: (columns: string) => QueryBuilder<T>;
  eq: (column: string, value: string) => QueryBuilder<T>;
  maybeSingle: () => Promise<{
    data: T | null;
    error: { message: string } | null;
  }>;
};

type DynamicTable = {
  select: <T = Record<string, unknown>>(columns: string) => QueryBuilder<T>;
};

type DynamicSupabaseClient = SupabaseClient & {
  from: (table: string) => DynamicTable;
};

export type StripeConnectState = {
  businessId?: string;
  accountId?: string;
  userId: string;
  exp: number;
};

export function getStripeSecretKeyMode(
  secretKey: string | undefined,
): StripeKeyMode | null {
  if (!secretKey?.startsWith('sk_')) {
    return null;
  }

  if (secretKey.startsWith('sk_test_')) {
    return 'test';
  }

  if (secretKey.startsWith('sk_live_')) {
    return 'live';
  }

  return null;
}

export function getStripeClientSecret() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret?.startsWith('sk_')) {
    throw new Error('Stripe is not configured');
  }
  return secret;
}

export function getSiteOrigin() {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_URL ??
    'http://localhost:3000';

  return baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
}

function stateSecret() {
  const explicit = process.env.OAUTH_STATE_SECRET?.trim();
  if (explicit && explicit.length >= 16) {
    return explicit;
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!stripeSecret) {
    throw new Error('Stripe is not configured');
  }

  return createHmac('sha256', stripeSecret)
    .update('keel-stripe-connect-state-v1')
    .digest('hex');
}

export function signStripeConnectState(payload: StripeConnectState) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', stateSecret())
    .update(body)
    .digest('base64url');

  return `${body}.${sig}`;
}

export function verifyStripeConnectState(
  token: string | null,
): StripeConnectState | null {
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length < 2) return null;

  const sig = parts.pop()!;
  const body = parts.join('.');
  const expected = createHmac('sha256', stateSecret())
    .update(body)
    .digest('base64url');

  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf-8'),
    ) as StripeConnectState;

    if (
      typeof parsed.userId !== 'string' ||
      typeof parsed.exp !== 'number' ||
      Date.now() > parsed.exp ||
      (!parsed.businessId && !parsed.accountId)
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function buildStripeConnectSettingsRedirect(
  client: SupabaseClient,
  params: {
    origin: string;
    businessId?: string | null;
    accountId?: string | null;
    query: Record<string, string>;
  },
): Promise<string> {
  const qs = new URLSearchParams(params.query);

  if (params.accountId) {
    const db = client as DynamicSupabaseClient;
    const accountResult = await db
      .from('accounts')
      .select('slug')
      .eq('id', params.accountId)
      .maybeSingle();

    const account = accountResult.data as { slug?: string | null } | null;
    if (account?.slug) {
      return `${params.origin}/app/work/${account.slug}/settings/payments?${qs.toString()}`;
    }
  }

  qs.set('section', 'business');

  if (params.businessId) {
    const db = client as DynamicSupabaseClient;
    const businessResult = await db
      .from('businesses')
      .select('slug, account_id')
      .eq('id', params.businessId)
      .maybeSingle();

    const business = businessResult.data as {
      slug?: string | null;
      account_id?: string | null;
    } | null;

    if (business?.account_id) {
      const accountResult = await db
        .from('accounts')
        .select('slug')
        .eq('id', business.account_id)
        .maybeSingle();

      const account = accountResult.data as { slug?: string | null } | null;

      if (account?.slug) {
        return `${params.origin}/home/${account.slug}/settings?${qs.toString()}`;
      }
    }

    if (business?.slug) {
      return `${params.origin}/home/${business.slug}/settings?${qs.toString()}`;
    }
  }

  return `${params.origin}/home?${qs.toString()}`;
}
