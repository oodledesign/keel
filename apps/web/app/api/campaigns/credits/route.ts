import { NextResponse } from 'next/server';

import { z } from 'zod';

import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  getCampaignUsage,
  listCampaignCreditTransactions,
} from '~/lib/campaign-credits/ledger';
import { loadCampaignUsageSnapshot } from '~/lib/campaigns/load-campaign-usage-snapshot';
import { userIsAccountMember } from '~/lib/rankly/account-membership';
import { listWorkspaceMailingListSubscribers } from '~/lib/workspace-forms/workspace-mailing-list';

export const runtime = 'nodejs';

const querySchema = z.object({
  accountId: z.string().uuid(),
});

export const GET = enhanceRouteHandler(
  async ({ request, user }) => {
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
    const client = getSupabaseServerClient();
    const isMember =
      accountId === user.id ||
      (await userIsAccountMember(client, user.id, accountId));

    if (!isMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = getSupabaseServerAdminClient();
    const subscribers = await listWorkspaceMailingListSubscribers(
      admin,
      accountId,
    ).catch(() => []);
    const [{ pool }, snapshot, transactions] = await Promise.all([
      getCampaignUsage(accountId),
      loadCampaignUsageSnapshot({
        accountId,
        contactsUsed: subscribers.length,
      }),
      listCampaignCreditTransactions(accountId).catch(() => []),
    ]);

    return NextResponse.json({
      balance: pool.balance,
      monthlyAllowance: snapshot.monthlyAllowance,
      maxContacts: snapshot.maxContacts,
      contactBonus: snapshot.contactBonus,
      planTier: snapshot.planTier,
      cycleEnd: snapshot.cycleEnd,
      packBalance: snapshot.packBalance,
      contactsUsed: snapshot.contactsUsed,
      transactions,
    });
  },
  { auth: true },
);
