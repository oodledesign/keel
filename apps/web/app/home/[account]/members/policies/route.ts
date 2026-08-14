import { NextResponse } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import {
  createInvitationContextBuilder,
  createInvitationsPolicyEvaluator,
} from '@kit/team-accounts/policies';

import { getMemberSeatUsage } from '~/lib/billing/entitlements';
import { getCommercialSeatBreakdown } from '~/lib/commercial/commercial-seat-access';

async function buildSeatUsageMetadata(
  client: SupabaseClient,
  accountId: string,
) {
  const { data: account } = await client
    .from('accounts')
    .select('space_type')
    .eq('id', accountId)
    .maybeSingle();

  if (
    (account as { space_type?: string | null } | null)?.space_type ===
    'commercial-property'
  ) {
    const breakdown = await getCommercialSeatBreakdown(client, accountId);
    const used = breakdown.billableCount + breakdown.supportCount;
    const remaining = Math.max(0, breakdown.maxMembers - used);

    return {
      used,
      maxMembers: breakdown.maxMembers,
      remaining,
      unlimited: false,
      commercial: {
        billableUsed: breakdown.billableCount,
        billableMax: breakdown.subscribedBillable,
        supportUsed: breakdown.supportCount,
        supportMax: breakdown.supportAllowance,
      },
    };
  }

  return getMemberSeatUsage(client, accountId);
}

export const GET = enhanceRouteHandler(
  async function ({ params, user }) {
    const client = getSupabaseServerClient();
    const { account } = z.object({ account: z.string() }).parse(params);

    try {
      const contextBuilder = createInvitationContextBuilder(client);

      const context = await contextBuilder.buildContext(
        {
          invitations: [],
          accountSlug: account,
        },
        user,
      );

      const seatUsage = await buildSeatUsageMetadata(client, context.accountId);

      // Evaluate with standard evaluator
      const evaluator = createInvitationsPolicyEvaluator();
      const hasPolicies = await evaluator.hasPoliciesForStage('preliminary');

      if (!hasPolicies) {
        return NextResponse.json({
          allowed: true,
          reasons: [],
          metadata: {
            policiesEvaluated: 0,
            timestamp: new Date().toISOString(),
            noPoliciesConfigured: true,
            seatUsage,
          },
        });
      }

      // validate against policies
      const result = await evaluator.canInvite(context, 'preliminary');

      return NextResponse.json({
        ...result,
        metadata: {
          ...(result as { metadata?: Record<string, unknown> }).metadata,
          seatUsage,
        },
      });
    } catch (error) {
      return NextResponse.json(
        {
          allowed: false,
          reasons: [
            error instanceof Error ? error.message : 'Unknown error occurred',
          ],
          metadata: {
            error: true,
            originalError:
              error instanceof Error ? error.message : String(error),
          },
        },
        { status: 500 },
      );
    }
  },
  {
    auth: true,
  },
);
