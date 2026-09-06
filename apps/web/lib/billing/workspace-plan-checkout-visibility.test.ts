import { describe, expect, it } from 'vitest';

import { shouldShowWorkspacePlanCheckout } from './workspace-plan-checkout-visibility';

describe('shouldShowWorkspacePlanCheckout', () => {
  const base = {
    canManageBilling: true,
    isBusinessLite: false,
    hasWorkspaceSubscription: false,
    hasBillingData: false,
    isSetupIntent: false,
    isUpgradeIntent: false,
    isBillingIntent: false,
  };

  it('hides checkout when the user cannot manage billing', () => {
    expect(
      shouldShowWorkspacePlanCheckout({ ...base, canManageBilling: false }),
    ).toEqual({ showPlanCheckout: false, showLiteUpgrade: false });
  });

  it('hides checkout when a workspace subscription already exists', () => {
    expect(
      shouldShowWorkspacePlanCheckout({
        ...base,
        hasWorkspaceSubscription: true,
        isSetupIntent: true,
      }),
    ).toEqual({ showPlanCheckout: false, showLiteUpgrade: false });
  });

  it('shows lite upgrade checkout after onboarding setup=1', () => {
    expect(
      shouldShowWorkspacePlanCheckout({
        ...base,
        isBusinessLite: true,
        isSetupIntent: true,
      }),
    ).toEqual({ showPlanCheckout: false, showLiteUpgrade: true });
  });

  it('shows lite upgrade checkout on upgrade=1', () => {
    expect(
      shouldShowWorkspacePlanCheckout({
        ...base,
        isBusinessLite: true,
        isUpgradeIntent: true,
      }),
    ).toEqual({ showPlanCheckout: false, showLiteUpgrade: true });
  });

  it('does not show lite checkout on a plain settings visit', () => {
    expect(
      shouldShowWorkspacePlanCheckout({
        ...base,
        isBusinessLite: true,
      }),
    ).toEqual({ showPlanCheckout: false, showLiteUpgrade: false });
  });

  it('shows paid-workspace checkout on setup=1 even if other billing data exists', () => {
    expect(
      shouldShowWorkspacePlanCheckout({
        ...base,
        hasBillingData: true,
        isSetupIntent: true,
      }),
    ).toEqual({ showPlanCheckout: true, showLiteUpgrade: false });
  });
});
