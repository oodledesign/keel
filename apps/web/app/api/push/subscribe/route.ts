import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { resyncTodayPlannerReminders } from '~/lib/planner/reminder-sync';

export const dynamic = 'force-dynamic';

const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
  leadMinutes: z.number().int().min(0).max(120).optional(),
});

export async function POST(request: NextRequest) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = subscribeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid subscription', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { subscription, leadMinutes } = parsed.data;
  const userAgent = request.headers.get('user-agent');

  const { error: subError } = await client.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: userAgent,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  );

  if (subError) {
    return NextResponse.json({ error: subError.message }, { status: 500 });
  }

  const { error: settingsError } = await client
    .from('planner_push_settings')
    .upsert(
      {
        user_id: user.id,
        enabled: true,
        lead_minutes: leadMinutes ?? 10,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

  if (settingsError) {
    return NextResponse.json({ error: settingsError.message }, { status: 500 });
  }

  try {
    await resyncTodayPlannerReminders(client, user.id);
  } catch {
    // Subscription saved; queue sync is best-effort.
  }

  return NextResponse.json({ success: true });
}

const unsubscribeSchema = z.object({
  endpoint: z.string().url().optional(),
});

export async function DELETE(request: NextRequest) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = unsubscribeSchema.safeParse(body);

  if (parsed.success && parsed.data.endpoint) {
    await client
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', parsed.data.endpoint);
  } else {
    await client.from('push_subscriptions').delete().eq('user_id', user.id);
  }

  const { count } = await client
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (!count) {
    await client.from('planner_push_settings').upsert(
      {
        user_id: user.id,
        enabled: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    await client
      .from('planner_reminders')
      .delete()
      .eq('user_id', user.id)
      .is('sent_at', null);
  }

  return NextResponse.json({ success: true });
}

export async function GET() {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [{ count }, { data: settings }] = await Promise.all([
    client
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
    client
      .from('planner_push_settings')
      .select('enabled, lead_minutes')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  const row = settings as {
    enabled?: boolean;
    lead_minutes?: number;
  } | null;

  return NextResponse.json({
    subscribed: (count ?? 0) > 0,
    enabled: row?.enabled ?? false,
    leadMinutes: row?.lead_minutes ?? 10,
  });
}
