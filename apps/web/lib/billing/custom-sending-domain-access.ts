/**
 * Who may configure a custom sending domain (and per-feature From toggles).
 *
 * Business Free/Lite stays on the Ozer platform domain. Paid business
 * (Starter/Pro), paid property, commercial property, billing-exempt
 * founding-partner grants, and an explicit `custom_sending_domain`
 * entitlement unlock the settings UI.
 *
 * Workspaces that already have an `account_sending_domains` row keep
 * access so existing SES identities and DNS are not locked behind a
 * later gate.
 */
export const CUSTOM_SENDING_DOMAIN_ENTITLEMENT = 'custom_sending_domain';

export const CUSTOM_SENDING_DOMAIN_PLAN_ENTITLEMENTS = [
  'workspace_business',
  'workspace_business_starter',
  'workspace_commercial_property',
  'workspace_property',
] as const;

export const CUSTOM_SENDING_DOMAIN_PLAN_FAMILIES = [
  'business',
  'business_starter',
  'commercial_property',
  'property',
] as const;

export type CustomSendingDomainAccessInput = {
  billingExempt: boolean;
  entitlementKeys: readonly string[];
  planFamily?: string | null;
  hasExistingSendingDomain: boolean;
};

export function isCustomSendingDomainAllowed(
  input: CustomSendingDomainAccessInput,
): boolean {
  if (input.billingExempt) {
    return true;
  }

  if (input.hasExistingSendingDomain) {
    return true;
  }

  if (input.entitlementKeys.includes(CUSTOM_SENDING_DOMAIN_ENTITLEMENT)) {
    return true;
  }

  if (
    CUSTOM_SENDING_DOMAIN_PLAN_ENTITLEMENTS.some((key) =>
      input.entitlementKeys.includes(key),
    )
  ) {
    return true;
  }

  const family = (input.planFamily ?? '').trim().toLowerCase();
  return (CUSTOM_SENDING_DOMAIN_PLAN_FAMILIES as readonly string[]).includes(
    family,
  );
}
