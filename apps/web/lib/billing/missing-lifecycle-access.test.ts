import { describe, expect, it } from 'vitest';

import { resolveMissingLifecycleAccess } from './missing-lifecycle-access';

describe('resolveMissingLifecycleAccess', () => {
  it('treats an active MakerKit subscription as full access', () => {
    expect(
      resolveMissingLifecycleAccess({
        hasActiveSubscription: true,
        hasWorkspacePlanEntitlement: false,
      }),
    ).toEqual({ level: 'full_access', reason: 'legacy_active_subscription' });
  });

  it('treats lite/starter entitlements as full access without Stripe', () => {
    expect(
      resolveMissingLifecycleAccess({
        hasActiveSubscription: false,
        hasWorkspacePlanEntitlement: true,
      }),
    ).toEqual({ level: 'full_access', reason: 'workspace_plan_entitlement' });
  });

  it('keeps no_access when there is no sub and no workspace plan', () => {
    expect(
      resolveMissingLifecycleAccess({
        hasActiveSubscription: false,
        hasWorkspacePlanEntitlement: false,
      }),
    ).toEqual({ level: 'no_access', reason: 'no_active_billing' });
  });
});
