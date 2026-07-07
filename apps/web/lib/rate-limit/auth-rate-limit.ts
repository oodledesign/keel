import { NextResponse } from 'next/server';

import { clientIpFromRequest } from './in-memory';

const WINDOW_MS = 15 * 60_000;
const MAX_ATTEMPTS = 5;

type Bucket = {
  timestamps: number[];
};

const buckets = new Map<string, Bucket>();

function prune(bucket: Bucket, now: number) {
  bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < WINDOW_MS);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function authRateLimitKey(scope: string, email: string, request: Request) {
  const ip = clientIpFromRequest(request);
  return `${scope}:${normalizeEmail(email)}:${ip}`;
}

export function isAuthRateLimited(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { timestamps: [] };
  prune(bucket, now);

  if (bucket.timestamps.length >= MAX_ATTEMPTS) {
    buckets.set(key, bucket);
    return true;
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return false;
}

export function authRateLimitResponse() {
  return NextResponse.json(
    { error: 'auth_rate_limited' },
    {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(WINDOW_MS / 1000)) },
    },
  );
}

export const AUTH_RATE_LIMIT = {
  windowMs: WINDOW_MS,
  maxAttempts: MAX_ATTEMPTS,
} as const;
