import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { applyParsedSesEvent } from '~/lib/workspace-email/apply-ses-event';
import {
  parseSesEventPayload,
  parseSnsEnvelope,
} from '~/lib/workspace-email/parse-ses-event';
import {
  type SnsMessageFields,
  snsSkipVerifyEnabled,
  verifySnsMessageSignature,
} from '~/lib/workspace-email/verify-sns-message';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Amazon SES → SNS → HTTPS webhook for workspace email analytics.
 *
 * Wire SNS topic `SES_EVENTS_SNS_TOPIC_ARN` as an event destination on the
 * workspace configuration set (`ozer-custom-domains` / SES_CONFIGURATION_SET).
 * Subscribe this endpoint: https://app.ozer.so/api/webhooks/ses
 */
export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const envelope = parseSnsEnvelope(body);
  if (!envelope || !envelope.type) {
    // Allow direct SES event JSON (useful in tests / manual replay)
    const direct = parseSesEventPayload(body);
    if (!direct) {
      return NextResponse.json(
        { error: 'Unrecognized payload' },
        { status: 400 },
      );
    }

    const admin = getSupabaseServerAdminClient();
    const result = await applyParsedSesEvent(admin, direct);
    return NextResponse.json({ ok: true, mode: 'direct', result });
  }

  if (!snsSkipVerifyEnabled()) {
    const fields = envelope.raw as SnsMessageFields;
    const valid = await verifySnsMessageSignature(fields);
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid SNS signature' },
        { status: 403 },
      );
    }
  }

  if (envelope.type === 'SubscriptionConfirmation') {
    if (!envelope.subscribeUrl) {
      return NextResponse.json(
        { error: 'Missing SubscribeURL' },
        { status: 400 },
      );
    }

    try {
      const confirm = await fetch(envelope.subscribeUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(15_000),
      });

      if (!confirm.ok) {
        return NextResponse.json(
          { error: `SubscribeURL failed (${confirm.status})` },
          { status: 502 },
        );
      }
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'SubscribeURL request failed',
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, confirmed: true });
  }

  if (envelope.type === 'UnsubscribeConfirmation') {
    return NextResponse.json({ ok: true, unsubscribed: true });
  }

  if (envelope.type !== 'Notification') {
    return NextResponse.json({ ok: true, ignored: envelope.type });
  }

  if (!envelope.message) {
    return NextResponse.json({ error: 'Empty SNS Message' }, { status: 400 });
  }

  let sesPayload: unknown;
  try {
    sesPayload = JSON.parse(envelope.message);
  } catch {
    return NextResponse.json(
      { error: 'SNS Message was not JSON' },
      { status: 400 },
    );
  }

  const parsed = parseSesEventPayload(sesPayload);
  if (!parsed) {
    return NextResponse.json({ ok: true, ignored: 'unrecognized-ses-event' });
  }

  const admin = getSupabaseServerAdminClient();
  const result = await applyParsedSesEvent(admin, parsed, {
    snsMessageId: envelope.messageId,
  });

  return NextResponse.json({ ok: true, result });
}
