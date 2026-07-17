import { type NextRequest } from 'next/server';

import { z } from 'zod';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  getOrCreateCreditBalance,
  totalCreditsAvailable,
} from '~/lib/ai/router';
import { userIsAccountMember } from '~/lib/rankly/account-membership';

export const runtime = 'nodejs';

const querySchema = z.object({
  accountId: z.string().uuid(),
});

export async function GET(request: NextRequest) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = querySchema.safeParse({
    accountId: request.nextUrl.searchParams.get('accountId'),
  });

  if (!parsed.success) {
    return Response.json({ error: 'Invalid accountId' }, { status: 400 });
  }

  const accountId = parsed.data.accountId;
  const isPersonalAccount = accountId === user.id;
  const isMember =
    isPersonalAccount ||
    (await userIsAccountMember(client, user.id, accountId));

  if (!isMember) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = getSupabaseServerAdminClient();
  await admin.rpc('reset_ai_credits_if_expired', {
    p_account_id: accountId,
  });

  const balance = await getOrCreateCreditBalance(accountId, admin);

  const limit = balance.credits_monthly_limit;
  const monthlyRemaining = balance.credits_remaining;
  const purchasedRemaining = balance.credits_purchased ?? 0;
  const remaining = totalCreditsAvailable(balance);
  const percentUsed =
    limit > 0
      ? Math.round(((limit - monthlyRemaining) / limit) * 1000) / 10
      : 0;

  return Response.json({
    creditsRemaining: remaining,
    creditsMonthlyRemaining: monthlyRemaining,
    creditsPurchasedRemaining: purchasedRemaining,
    creditsMonthlyLimit: limit,
    periodEnd: balance.period_end,
    percentUsed,
  });
}
