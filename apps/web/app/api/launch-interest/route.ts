import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  type LaunchInterestSource,
  parseLaunchInterestSource,
} from '~/lib/marketing/launch-interest';
import { rateLimitApiRequest } from '~/lib/rate-limit/api-rate-limit';
import { notifyAdminWaitlistSignup } from '~/lib/server/notify-admin-waitlist';

export const dynamic = 'force-dynamic';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_INTERESTS = [
  'ios',
  'property',
  'community',
  'rankly',
  'feeds',
  'commercial',
] as const;

type LaunchInterest = (typeof VALID_INTERESTS)[number];

const DEFAULT_INTERESTS: LaunchInterest[] = [
  'ios',
  'property',
  'community',
  'rankly',
  'feeds',
];

type LaunchInterestInsert = {
  email: string;
  interests: LaunchInterest[];
  source: LaunchInterestSource;
};

type QueryResult = {
  error: { message: string } | null;
};

type CountResult = QueryResult & {
  count: number | null;
};

type LaunchInterestQuery = {
  select: (
    columns: string,
    options: { count: 'exact'; head: true },
  ) => {
    eq: (column: 'email', value: string) => Promise<CountResult>;
  };
  insert: (value: LaunchInterestInsert) => Promise<QueryResult>;
};

type LaunchInterestClient = {
  from: (table: 'launch_interest') => LaunchInterestQuery;
};

function normaliseInterests(input: unknown): LaunchInterest[] {
  if (!Array.isArray(input)) {
    return DEFAULT_INTERESTS;
  }

  const selected = input.filter((item): item is LaunchInterest => {
    return (
      typeof item === 'string' &&
      VALID_INTERESTS.includes(item as LaunchInterest)
    );
  });

  return selected.length ? selected : DEFAULT_INTERESTS;
}

export async function POST(request: Request) {
  const limited = rateLimitApiRequest(request, {
    scope: 'launch-interest',
    limit: 10,
  });

  if (limited) {
    return limited;
  }

  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    interests?: unknown;
    source?: unknown;
  } | null;

  const email =
    typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json(
      { error: 'Please enter a valid email address.' },
      { status: 400 },
    );
  }

  const client =
    getSupabaseServerAdminClient() as unknown as LaunchInterestClient;

  const { count, error: countError } = await client
    .from('launch_interest')
    .select('id', { count: 'exact', head: true })
    .eq('email', email);

  if (countError) {
    return NextResponse.json(
      { error: 'We could not save your email just now. Please try again.' },
      { status: 500 },
    );
  }

  if ((count ?? 0) >= 3) {
    return NextResponse.json(
      { error: 'You are already on the list. Thank you.' },
      { status: 429 },
    );
  }

  const normalisedInterests = normaliseInterests(body?.interests);
  const parsedSource = parseLaunchInterestSource(body?.source);

  const { error } = await client.from('launch_interest').insert({
    email,
    interests: normalisedInterests,
    source: parsedSource,
  });

  if (error) {
    return NextResponse.json(
      { error: 'We could not save your email just now. Please try again.' },
      { status: 500 },
    );
  }

  // Fire-and-forget admin notification (fails safely without blocking response)
  void notifyAdminWaitlistSignup({
    email,
    source: parsedSource,
    interests: normalisedInterests,
  });

  return NextResponse.json({
    message: "You're on the list — we'll email you at launch.",
  });
}
