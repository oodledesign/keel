import { createHmac, timingSafeEqual } from 'node:crypto';

import { type NextRequest, NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { createBunnyStreamClient } from '@kit/bunny';

import {
  clientIpFromRequest,
  isRateLimited,
} from '~/lib/rate-limit/in-memory';
import { resolveBunnyCdnHostname } from '~/lib/videos/server/videos-data';

export const runtime = 'nodejs';

function verifyBunnySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader?.trim()) return false;

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const received = signatureHeader.trim().toLowerCase();

  try {
    return timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(received, 'utf8'),
    );
  } catch {
    return false;
  }
}

type BunnyWebhookPayload = {
  VideoGuid?: string;
  VideoLibraryId?: number | string;
  Status?: number;
  Type?: string;
  EventName?: string;
};

async function logVideoEvent(input: {
  accountId: string | null;
  bunnyVideoId: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  ipAddress: string;
}) {
  const admin = getSupabaseServerAdminClient();
  await admin.from('video_events').insert({
    account_id: input.accountId,
    bunny_video_id: input.bunnyVideoId,
    event_type: input.eventType,
    payload: input.payload,
    ip_address: input.ipAddress,
  });
}

export async function POST(request: NextRequest) {
  const ip = clientIpFromRequest(request);
  if (isRateLimited(`bunny-webhook:${ip}`)) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }

  const secret = process.env.BUNNY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const rawBody = await request.text();
  const signature =
    request.headers.get('x-bunny-signature') ??
    request.headers.get('X-Bunny-Signature');

  if (!verifyBunnySignature(rawBody, signature, secret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let payload: BunnyWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as BunnyWebhookPayload;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const bunnyVideoId = payload.VideoGuid ?? null;
  const eventName = (payload.EventName ?? payload.Type ?? 'unknown').toLowerCase();

  const admin = getSupabaseServerAdminClient();
  let accountId: string | null = null;

  if (bunnyVideoId) {
    const { data: videoRow } = await admin
      .from('videos')
      .select('account_id')
      .eq('bunny_video_id', bunnyVideoId)
      .maybeSingle();

    accountId = (videoRow?.account_id as string | undefined) ?? null;
  }

  await logVideoEvent({
    accountId,
    bunnyVideoId,
    eventType: eventName,
    payload: payload as Record<string, unknown>,
    ipAddress: ip,
  });

  if (!bunnyVideoId) {
    return NextResponse.json({ ok: true });
  }

  const statusCode = payload.Status;

  let nextStatus: 'ready' | 'failed' | 'processing' | null = null;

  if (
    eventName.includes('encoded') ||
    eventName.includes('finished') ||
    statusCode === 4
  ) {
    nextStatus = 'ready';
  } else if (
    eventName.includes('failed') ||
    eventName.includes('error') ||
    statusCode === 5
  ) {
    nextStatus = 'failed';
  } else if (eventName.includes('processing') || eventName.includes('upload')) {
    nextStatus = 'processing';
  }

  if (!nextStatus) {
    return NextResponse.json({ ok: true });
  }

  const patch: Record<string, unknown> = { status: nextStatus };

  if (nextStatus === 'ready') {
    const libraryId = payload.VideoLibraryId
      ? String(payload.VideoLibraryId)
      : undefined;
    const cdnHostname = await resolveBunnyCdnHostname(libraryId);
    if (cdnHostname) {
      const host = cdnHostname.replace(/^https?:\/\//, '').replace(/\/$/, '');
      patch.thumbnail_url = `https://${host}/${bunnyVideoId}/thumbnail.jpg`;
    } else {
      try {
        const bunnyVideo = await createBunnyStreamClient().getVideo(
          libraryId ?? '',
          bunnyVideoId,
        );
        if (bunnyVideo.thumbnailUrl) {
          patch.thumbnail_url = bunnyVideo.thumbnailUrl;
        }
      } catch {
        // Best-effort thumbnail sync; status still updates.
      }
    }
  }

  await admin
    .from('videos')
    .update(patch)
    .eq('bunny_video_id', bunnyVideoId);

  return NextResponse.json({ ok: true });
}
