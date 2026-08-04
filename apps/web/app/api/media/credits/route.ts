import { NextResponse } from 'next/server';

import { z } from 'zod';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { getMediaBalance } from '~/lib/media-credits/ledger';
import { userIsAccountMember } from '~/lib/rankly/account-membership';

export const runtime = 'nodejs';

const querySchema = z.object({
  accountId: z.string().uuid(),
});

export async function GET(request: Request) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = querySchema.safeParse({
    accountId: new URL(request.url).searchParams.get('accountId'),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid accountId' }, { status: 400 });
  }

  const accountId = parsed.data.accountId;
  const isMember =
    accountId === user.id ||
    (await userIsAccountMember(client, user.id, accountId));

  if (!isMember) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const balance = await getMediaBalance(accountId);
  const admin = getSupabaseServerAdminClient();

  const { data: pool } = await admin
    .from('media_credit_pools')
    .select('monthly_allowance, plan_tier, cycle_start, cycle_end')
    .eq('account_id', accountId)
    .maybeSingle();

  const { data: transactions } = await admin
    .from('media_credit_transactions')
    .select('id, type, amount, reason, created_at, related_job_id')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(20);

  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);

  const { data: expiring } = await admin
    .from('media_credit_batches')
    .select('units_remaining, expires_at')
    .eq('account_id', accountId)
    .eq('source_type', 'topup_purchase')
    .gt('units_remaining', 0)
    .is('swept_at', null)
    .lte('expires_at', in30Days.toISOString())
    .order('expires_at', { ascending: true });

  const poolRow = pool as {
    monthly_allowance?: number;
    plan_tier?: string;
    cycle_start?: string | null;
    cycle_end?: string | null;
  } | null;

  return NextResponse.json({
    balance,
    monthlyAllowance: poolRow?.monthly_allowance ?? 0,
    planTier: poolRow?.plan_tier ?? 'none',
    cycleStart: poolRow?.cycle_start ?? null,
    cycleEnd: poolRow?.cycle_end ?? null,
    transactions: transactions ?? [],
    expiringTopups: (expiring ?? []).map((row) => ({
      units: (row as { units_remaining: number }).units_remaining,
      expiresAt: (row as { expires_at: string }).expires_at,
    })),
  });
}
