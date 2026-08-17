import { NextResponse } from 'next/server';

import { clientIpFromRequest } from './in-memory';

const WINDOW_MS = 15 * 60_000;
const MAX_ATTEMPTS = 20;

type Bucket = { timestamps: number[] };
const buckets = new Map<string, Bucket>();

function prune(bucket: Bucket, now: number) {
  bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < WINDOW_MS);
}

export function isRequirementFormRateLimited(request: Request): boolean {
  const ip = clientIpFromRequest(request);
  const key = `requirement-form:${ip}`;
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

export function requirementFormRateLimitResponse() {
  return NextResponse.json(
    { error: 'Too many submissions. Please try again later.' },
    { status: 429 },
  );
}
