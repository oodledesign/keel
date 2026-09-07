import { describe, expect, it } from 'vitest';

import {
  CUSTOM_SENDING_DOMAIN_ENTITLEMENT,
  isCustomSendingDomainAllowed,
} from './custom-sending-domain-access';

describe('isCustomSendingDomainAllowed', () => {
  const denied = {
    billingExempt: false,
    entitlementKeys: [] as string[],
    planFamily: null as string | null,
    hasExistingSendingDomain: false,
  };

  it('denies Free/Lite with no grant', () => {
    expect(
      isCustomSendingDomainAllowed({
        ...denied,
        entitlementKeys: ['workspace_business_lite'],
        planFamily: 'business_lite',
      }),
    ).toBe(false);
  });

  it('allows Business Starter and Pro', () => {
    expect(
      isCustomSendingDomainAllowed({
        ...denied,
        entitlementKeys: ['workspace_business_starter'],
      }),
    ).toBe(true);
    expect(
      isCustomSendingDomainAllowed({
        ...denied,
        entitlementKeys: ['workspace_business'],
      }),
    ).toBe(true);
  });

  it('allows commercial property entitlement (founding / paid agency)', () => {
    expect(
      isCustomSendingDomainAllowed({
        ...denied,
        entitlementKeys: ['workspace_commercial_property'],
      }),
    ).toBe(true);
  });

  it('allows property entitlement', () => {
    expect(
      isCustomSendingDomainAllowed({
        ...denied,
        entitlementKeys: ['workspace_property'],
      }),
    ).toBe(true);
  });

  it('allows billing-exempt founding-partner grants', () => {
    expect(
      isCustomSendingDomainAllowed({
        ...denied,
        billingExempt: true,
        entitlementKeys: ['workspace_business_lite'],
      }),
    ).toBe(true);
  });

  it('allows an explicit custom_sending_domain grant', () => {
    expect(
      isCustomSendingDomainAllowed({
        ...denied,
        entitlementKeys: [CUSTOM_SENDING_DOMAIN_ENTITLEMENT],
      }),
    ).toBe(true);
  });

  it('allows a paid plan_family even if entitlement rows drifted', () => {
    expect(
      isCustomSendingDomainAllowed({
        ...denied,
        planFamily: 'commercial_property',
      }),
    ).toBe(true);
  });

  it('grandfathers workspaces that already have a sending-domain row', () => {
    expect(
      isCustomSendingDomainAllowed({
        ...denied,
        hasExistingSendingDomain: true,
      }),
    ).toBe(true);
  });

  it('does not treat leftover lite as a deny when a paid grant exists', () => {
    expect(
      isCustomSendingDomainAllowed({
        ...denied,
        entitlementKeys: [
          'workspace_business_lite',
          'workspace_commercial_property',
        ],
        planFamily: 'business_lite',
      }),
    ).toBe(true);
  });
});
