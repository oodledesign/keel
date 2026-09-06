/**
 * When the workspace plan checkout form should render on settings/billing.
 *
 * Business onboarding creates workspaces as Free (lite) first, then sends
 * Starter/Pro to `?setup=1`. Hiding checkout for lite except `?upgrade=1`
 * silently dropped that handoff — settings showed Free + no Stripe session.
 */
export function shouldShowWorkspacePlanCheckout(input: {
  canManageBilling: boolean;
  isBusinessLite: boolean;
  hasWorkspaceSubscription: boolean;
  hasBillingData: boolean;
  isSetupIntent: boolean;
  isUpgradeIntent: boolean;
  isBillingIntent: boolean;
}): { showPlanCheckout: boolean; showLiteUpgrade: boolean } {
  if (!input.canManageBilling || input.hasWorkspaceSubscription) {
    return { showPlanCheckout: false, showLiteUpgrade: false };
  }

  const wantsPaidPlan =
    input.isSetupIntent || input.isUpgradeIntent || input.isBillingIntent;

  if (input.isBusinessLite) {
    return {
      showPlanCheckout: false,
      showLiteUpgrade: wantsPaidPlan || input.isUpgradeIntent,
    };
  }

  return {
    showPlanCheckout:
      !input.hasBillingData || input.isBillingIntent || input.isSetupIntent,
    showLiteUpgrade: false,
  };
}
