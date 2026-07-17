import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const secret =
    req.nextUrl.searchParams.get('secret') ??
    req.headers.get('x-webhook-secret');

  if (secret !== process.env.ZEPTOMAIL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: Record<string, unknown>;

  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventNames = (payload['event_name'] as string[]) ?? [];
  const messages =
    (payload['event_message'] as Array<Record<string, unknown>>) ?? [];
  const eventName = eventNames[0]?.toLowerCase() ?? '';

  for (const message of messages) {
    const emailInfo = (message['email_info'] as Record<string, unknown>) ?? {};
    const eventData =
      (message['event_data'] as Array<Record<string, unknown>>) ?? [];
    const subject = (emailInfo['subject'] as string) ?? null;
    const emailReference = (emailInfo['email_reference'] as string) ?? null;

    const toList =
      (emailInfo['to'] as Array<{ email_address?: { address?: string } }>) ??
      [];
    const primaryRecipient = toList[0]?.email_address?.address?.toLowerCase();

    if (eventName === 'hardbounce') {
      const recipient = extractBouncedRecipient(eventData) ?? primaryRecipient;
      if (recipient) await suppress(recipient, 'hard_bounce', message);
    } else if (eventName === 'softbounce') {
      const recipient = extractBouncedRecipient(eventData) ?? primaryRecipient;
      if (recipient) await suppressSoft(recipient, message);
    } else if (
      ['complaint', 'feedback', 'feedbackloop', 'spam'].includes(eventName)
    ) {
      if (primaryRecipient) {
        await suppress(primaryRecipient, 'complaint', message);
      }
    } else if (eventName === 'open') {
      if (primaryRecipient) {
        await logEvent(
          primaryRecipient,
          'open',
          subject,
          emailReference,
          null,
          message,
        );
      }
    } else if (eventName === 'click') {
      const clickedUrl = extractClickedUrl(eventData);
      if (primaryRecipient) {
        await logEvent(
          primaryRecipient,
          'click',
          subject,
          emailReference,
          clickedUrl,
          message,
        );
      }
    } else if (eventName === 'delivered') {
      if (primaryRecipient) {
        await logEvent(
          primaryRecipient,
          'delivered',
          subject,
          emailReference,
          null,
          message,
        );
      }
    }
  }

  return NextResponse.json({ ok: true });
}

function extractBouncedRecipient(
  eventData: Array<Record<string, unknown>>,
): string | undefined {
  for (const block of eventData) {
    const details = (block['details'] as Array<Record<string, unknown>>) ?? [];
    for (const d of details) {
      const r = d['bounced_recipient'] as string | undefined;
      if (r) return r.toLowerCase();
    }
  }

  return undefined;
}

function extractClickedUrl(
  eventData: Array<Record<string, unknown>>,
): string | null {
  for (const block of eventData) {
    const details = (block['details'] as Array<Record<string, unknown>>) ?? [];
    for (const d of details) {
      const url = (d['clicked_link'] ?? d['url']) as string | undefined;
      if (url) return url;
    }
  }

  return null;
}

async function suppress(
  email: string,
  reason: 'hard_bounce' | 'complaint',
  raw: unknown,
) {
  const supabase = getSupabaseServerAdminClient();
  await supabase
    .from('email_suppressions')
    .upsert({ email, reason, raw_notification: raw }, { onConflict: 'email' });
}

async function suppressSoft(email: string, raw: unknown) {
  const supabase = getSupabaseServerAdminClient();
  const { data: existing } = await supabase
    .from('email_suppressions')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (!existing) {
    await supabase.from('email_suppressions').insert({
      email,
      reason: 'soft_bounce',
      raw_notification: raw,
    });
  }
}

async function logEvent(
  email: string,
  eventType: 'delivered' | 'open' | 'click',
  subject: string | null,
  emailReference: string | null,
  clickedUrl: string | null,
  raw: unknown,
) {
  const supabase = getSupabaseServerAdminClient();
  await supabase.from('email_events').insert({
    email,
    event_type: eventType,
    subject,
    email_reference: emailReference,
    clicked_url: clickedUrl,
    raw_event: raw,
  });
}
