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

/**
 * Bunny Stream signs webhooks with the library Read-Only API key.
 * See https://docs.bunny.net/stream/webhooks
 *
 * Configure the library webhook URL to:
 *   https://app.ozer.so/api/bunny/webhook
 * (not a *.vercel.app preview/legacy host)
 */
function getWebhookSigningSecret(): string | null {
  return (
    process.env.BUNNY_STREAM_READ_API_KEY?.trim() ||
    process.env.BUNNY_WEBHOOK_SECRET?.trim() ||
    null
  );
}

function verifyBunnyStreamSignature(
  rawBody: string,
  request: NextRequest,
  secret: string,
): boolean {
  const signature =
    request.headers.get('x-bunnystream-signature') ??
    request.headers.get('X-BunnyStream-Signature') ??
    request.headers.get('x-bunny-signature') ??
    request.headers.get('X-Bunny-Signature');

  const version =
    request.headers.get('x-bunnystream-signature-version') ??
    request.headers.get('X-BunnyStream-Signature-Version');

  const algorithm =
    request.headers.get('x-bunnystream-signature-algorithm') ??
    request.headers.get('X-BunnyStream-Signature-Algorithm');

  // Bunny Stream signed webhooks include version + algorithm headers.
  // Legacy payloads may only send a signature header — still verify HMAC.
  if (version && version !== 'v1') return false;
  if (algorithm && algorithm !== 'hmac-sha256') return false;
  if (!signature?.trim()) return false;

  const expected = createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex');
  const received = signature.trim().toLowerCase();

  if (
    received.length !== expected.length ||
    !/^[0-9a-f]+$/.test(received)
  ) {
    return false;
  }

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

function mapWebhookStatus(payload: BunnyWebhookPayload): {
  nextStatus: 'ready' | 'failed' | 'processing' | 'uploading' | null;
  eventType: string;
} {
  const statusCode =
    typeof payload.Status === 'number' ? payload.Status : Number(payload.Status);
  const eventName = (payload.EventName ?? payload.Type ?? '').toLowerCase();

  if (
    statusCode === 3 ||
    statusCode === 4 ||
    eventName.includes('encoded') ||
    eventName.includes('finished')
  ) {
    return { nextStatus: 'ready', eventType: eventName || `status_${statusCode}` };
  }

  if (
    statusCode === 5 ||
    statusCode === 8 ||
    eventName.includes('failed') ||
    eventName.includes('error')
  ) {
    return { nextStatus: 'failed', eventType: eventName || `status_${statusCode}` };
  }

  if (statusCode === 6 || statusCode === 7) {
    return {
      nextStatus: 'uploading',
      eventType: eventName || `status_${statusCode}`,
    };
  }

  if (
    statusCode === 0 ||
    statusCode === 1 ||
    statusCode === 2 ||
    eventName.includes('processing') ||
    eventName.includes('encoding') ||
    eventName.includes('upload')
  ) {
    return {
      nextStatus: 'processing',
      eventType: eventName || `status_${statusCode}`,
    };
  }

  return {
    nextStatus: null,
    eventType: eventName || (Number.isFinite(statusCode) ? `status_${statusCode}` : 'unknown'),
  };
}

export async function POST(request: NextRequest) {
  const ip = clientIpFromRequest(request);
  if (isRateLimited(`bunny-webhook:${ip}`)) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }

  const secret = getWebhookSigningSecret();
  if (!secret) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const rawBody = await request.text();

  if (!verifyBunnyStreamSignature(rawBody, request, secret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let payload: BunnyWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as BunnyWebhookPayload;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const bunnyVideoId = payload.VideoGuid ?? null;
  const { nextStatus, eventType } = mapWebhookStatus(payload);

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
    eventType,
    payload: payload as Record<string, unknown>,
    ipAddress: ip,
  });

  if (!bunnyVideoId || !nextStatus) {
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
