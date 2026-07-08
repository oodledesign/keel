import { definePolicy, deny, allow } from '@kit/policies';
import {
  invitationPolicyRegistry,
  type FeaturePolicyInvitationContext,
} from '@kit/team-accounts/policies';

import { assertMemberInviteAllowed } from './entitlements';

const seatLimitInvitationPolicy = definePolicy<FeaturePolicyInvitationContext>({
  id: 'ozer-seat-limit',
  stages: ['submission'],
  evaluate: async (context) => {
    const { getSupabaseServerClient } = await import(
      '@kit/supabase/server-client'
    );

    const client = getSupabaseServerClient();
    const result = await assertMemberInviteAllowed(
      client,
      context.accountId,
      context.currentMemberCount,
      context.invitations.length,
    );

    if (!result.allowed) {
      return deny({
        code: 'SEAT_LIMIT_REACHED',
        message: result.reason ?? 'Team member limit reached for your plan.',
        remediation: 'Upgrade your workspace plan to invite more members.',
      });
    }

    return allow();
  },
});

let registered = false;

export function registerOzerBillingPolicies() {
  if (registered) {
    return;
  }

  invitationPolicyRegistry.registerPolicy(seatLimitInvitationPolicy);
  registered = true;
}
