import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { rateLimitApiRequest } from '~/lib/rate-limit/api-rate-limit';

export const dynamic = 'force-dynamic';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_INTERESTS = ['property', 'community', 'rankly', 'feeds'] as const;
const DEFAULT_INTERESTS = [...VALID_INTERESTS];

type LaunchInterest = (typeof VALID_INTERESTS)[number];

type LaunchInterestInsert = {
  email: string;
  interests: LaunchInterest[];
  source: 'coming-soon';
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
    return typeof item === 'string' && VALID_INTERESTS.includes(item as LaunchInterest);
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
  } | null;

  const email =
    typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json(
      { error: 'Please enter a valid email address.' },
      { status: 400 },
    );
  }

  const client = getSupabaseServerAdminClient() as unknown as LaunchInterestClient;

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

  const { error } = await client.from('launch_interest').insert({
    email,
    interests: normaliseInterests(body?.interests),
    source: 'coming-soon',
  });

  if (error) {
    return NextResponse.json(
      { error: 'We could not save your email just now. Please try again.' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    message: "You're on the list — we'll email you at launch.",
  });
}
