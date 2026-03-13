import { allow, definePolicy, deny } from '@kit/policies';
import { createPolicyRegistry } from '@kit/policies';

import { FeaturePolicyInvitationContext } from './feature-policy-invitation-context';

/**
 * Feature-specific registry for invitation policies
 */
export const invitationPolicyRegistry = createPolicyRegistry();

/**
 * Subscription required policy
 * Checks if the account has an active subscription
 */
export const subscriptionRequiredInvitationsPolicy =
  definePolicy<FeaturePolicyInvitationContext>({
    id: 'subscription-required',
    stages: ['preliminary', 'submission'],
    evaluate: async ({ subscription }) => {
      if (!subscription || !subscription.active) {
        return deny({
          code: 'SUBSCRIPTION_REQUIRED',
          message: 'teams:policyErrors.subscriptionRequired',
          remediation: 'teams:policyRemediation.subscriptionRequired',
        });
      }

      return allow();
    },
  });

/**
 * Paddle billing policy
 * Checks if the account has a paddle subscription and is in a trial period
 */
export const paddleBillingInvitationsPolicy =
  definePolicy<FeaturePolicyInvitationContext>({
    id: 'paddle-billing',
    stages: ['preliminary', 'submission'],
    evaluate: async ({ subscription }) => {
      // combine with subscriptionRequiredPolicy if subscription must be required
      if (!subscription) {
        return allow();
      }

      // Paddle specific constraint: cannot update subscription items during trial
      if (
        subscription.provider === 'paddle' &&
        subscription.status === 'trialing'
      ) {
        const hasPerSeatItems = subscription.items.some(
          (item) => item.type === 'per_seat',
        );

        if (hasPerSeatItems) {
          return deny({
            code: 'PADDLE_TRIAL_RESTRICTION',
            message: 'teams:policyErrors.paddleTrialRestriction',
            remediation: 'teams:policyRemediation.paddleTrialRestriction',
          });
        }
      }

      return allow();
    },
  });

// register policies below to apply them
//
//
