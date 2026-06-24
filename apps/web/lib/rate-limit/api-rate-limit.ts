import { NextResponse } from 'next/server';

import { clientIpFromRequest, isRateLimited } from './in-memory';

type RateLimitOptions = {
  /** Prefix for the bucket key (e.g. route name). */
  scope: string;
  /** Max requests per sliding window (default 60s). */
  limit?: number;
  /** Optional stable id (e.g. user id) in addition to client IP. */
  subject?: string;
};

export function rateLimitApiRequest(
  request: Request,
  { scope, limit = 30, subject }: RateLimitOptions,
): NextResponse | null {
  const ip = clientIpFromRequest(request);
  const key = subject ? `${scope}:${subject}:${ip}` : `${scope}:${ip}`;

  if (!isRateLimited(key, limit)) {
    return null;
  }

  return NextResponse.json(
    { error: 'Too many requests. Please try again shortly.' },
    {
      status: 429,
      headers: { 'Retry-After': '60' },
    },
  );
}
