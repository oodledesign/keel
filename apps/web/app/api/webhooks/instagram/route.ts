import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { getMetaWebhookVerifyToken } from '~/lib/instagram-autoreply/env';
import {
  type MetaCommentWebhookValue,
  processInstagramCommentEvent,
} from '~/lib/instagram-autoreply/process-comment-event';
import type { IgConnectedAccountRow } from '~/lib/instagram-autoreply/types';
import { verifyMetaWebhookSignature } from '~/lib/instagram-autoreply/webhook-verify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type MetaWebhookEntry = {
  id?: string;
  changes?: Array<{
    field?: string;
    value?: MetaCommentWebhookValue & { verb?: string };
  }>;
};

type MetaWebhookBody = {
  object?: string;
  entry?: MetaWebhookEntry[];
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  const expected = getMetaWebhookVerifyToken();

  if (mode === 'subscribe' && expected && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256');

  if (!verifyMetaWebhookSignature(rawBody, signature)) {
    console.error('[instagram-webhook] invalid signature', {
      hasSignature: Boolean(signature),
      bodyLength: rawBody.length,
    });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body: MetaWebhookBody;
  try {
    body = JSON.parse(rawBody) as MetaWebhookBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (body.object !== 'instagram') {
    return NextResponse.json({ received: true });
  }

  const admin = getSupabaseServerAdminClient();
  let processed = 0;

  for (const entry of body.entry ?? []) {
    const igBusinessAccountId = entry.id?.trim();
    if (!igBusinessAccountId) continue;

    const { data: igAccount, error: accountError } = await admin
      .from('ig_connected_accounts')
      .select('*')
      .eq('ig_business_account_id', igBusinessAccountId)
      .eq('is_active', true)
      .maybeSingle();

    if (accountError) {
      console.error('[instagram-webhook] account lookup failed', accountError);
      continue;
    }

    if (!igAccount) {
      console.warn('[instagram-webhook] no connected account for IG id', {
        igBusinessAccountId,
      });
      continue;
    }

    for (const change of entry.changes ?? []) {
      if (change.field !== 'comments') continue;
      const value = change.value;
      if (!value?.id) continue;
      if (value.verb && value.verb !== 'add') continue;

      try {
        await processInstagramCommentEvent(admin, {
          igAccount: igAccount as IgConnectedAccountRow,
          comment: value,
        });
        processed += 1;
      } catch (error) {
        console.error(
          '[instagram-webhook] process failed',
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  if (processed > 0) {
    console.info('[instagram-webhook] processed comments', { processed });
  }

  return NextResponse.json({ received: true });
}
