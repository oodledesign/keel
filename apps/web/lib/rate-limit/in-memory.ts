const WINDOW_MS = 60_000;
const MAX_REQUESTS = 100;

type Bucket = {
  timestamps: number[];
};

const buckets = new Map<string, Bucket>();

function prune(bucket: Bucket, now: number) {
  bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < WINDOW_MS);
}

export function isRateLimited(key: string, limit = MAX_REQUESTS): boolean {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { timestamps: [] };
  prune(bucket, now);

  if (bucket.timestamps.length >= limit) {
    buckets.set(key, bucket);
    return true;
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return false;
}

export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }

  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}
