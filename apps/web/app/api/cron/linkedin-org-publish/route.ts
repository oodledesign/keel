import { timingSafeEqual } from 'crypto';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { processDueLinkedInPosts } from '~/lib/commercial/linkedin-publishing/process-scheduled-posts';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

export const runtime = 'nodejs';
export const maxDuration = 120;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const incoming = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(incoming);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  try {
    const result = await processDueLinkedInPosts(
      getSupabaseServerAdminClient(),
    );
    return jsonOk(result);
  } catch (error) {
    console.error('[linkedin-org] scheduled publish cron', error);
    return jsonErr(
      'CRON_FAILED',
      error instanceof Error ? error.message : 'LinkedIn publish cron failed',
      500,
    );
  }
}
