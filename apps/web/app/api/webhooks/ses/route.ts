import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  let envelope: Record<string, unknown>;

  try {
    envelope = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const messageType = envelope['Type'] as string;

  if (messageType === 'SubscriptionConfirmation') {
    const subscribeUrl = envelope['SubscribeURL'] as string;
    if (subscribeUrl?.startsWith('https://sns.eu-west-2.amazonaws.com')) {
      await fetch(subscribeUrl);
    }
    return NextResponse.json({ ok: true });
  }

  if (messageType !== 'Notification') {
    return NextResponse.json({ ok: true });
  }

  let notification: Record<string, unknown>;

  try {
    notification = JSON.parse(envelope['Message'] as string);
  } catch {
    return NextResponse.json({ error: 'Invalid notification body' }, { status: 400 });
  }

  const notificationType = notification['notificationType'] as string;

  if (notificationType === 'Bounce') {
    await handleBounce(notification);
  } else if (notificationType === 'Complaint') {
    await handleComplaint(notification);
  }

  return NextResponse.json({ ok: true });
}

async function handleBounce(notification: Record<string, unknown>) {
  const supabase = getSupabaseServerAdminClient();
  const bounce = notification['bounce'] as Record<string, unknown>;
  const bounceType = bounce['bounceType'] as string;
  const bounceSubtype = bounce['bounceSubType'] as string;
  const recipients = bounce['bouncedRecipients'] as Array<{ emailAddress: string }>;
  const reason = bounceType === 'Permanent' ? 'hard_bounce' : 'soft_bounce';

  for (const recipient of recipients) {
    const email = recipient.emailAddress.toLowerCase();

    if (reason === 'hard_bounce') {
      await supabase.from('email_suppressions').upsert(
        {
          email,
          reason,
          bounce_type: bounceType,
          bounce_subtype: bounceSubtype,
          raw_notification: notification,
        },
        { onConflict: 'email' },
      );
    } else {
      const { data: existing } = await supabase
        .from('email_suppressions')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (!existing) {
        await supabase.from('email_suppressions').insert({
          email,
          reason,
          bounce_type: bounceType,
          bounce_subtype: bounceSubtype,
          raw_notification: notification,
        });
      }
    }
  }
}

async function handleComplaint(notification: Record<string, unknown>) {
  const supabase = getSupabaseServerAdminClient();
  const complaint = notification['complaint'] as Record<string, unknown>;
  const complaintType = complaint['complaintFeedbackType'] as string;
  const recipients = complaint['complainedRecipients'] as Array<{ emailAddress: string }>;

  for (const recipient of recipients) {
    const email = recipient.emailAddress.toLowerCase();

    await supabase.from('email_suppressions').upsert(
      {
        email,
        reason: 'complaint',
        complaint_type: complaintType,
        raw_notification: notification,
      },
      { onConflict: 'email' },
    );
  }
}
