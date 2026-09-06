import { describe, expect, it } from 'vitest';

import {
  DEFAULT_OUTBOUND_EMAIL_SETTINGS,
  parseOutboundEmailSettings,
  shouldUseCustomSendingDomain,
} from './outbound-email-settings';

describe('parseOutboundEmailSettings', () => {
  it('defaults every feature off', () => {
    expect(parseOutboundEmailSettings(null)).toEqual(
      DEFAULT_OUTBOUND_EMAIL_SETTINGS,
    );
  });

  it('reads only explicit true flags', () => {
    expect(
      parseOutboundEmailSettings({
        invoices: true,
        proposals: 'yes',
        contracts: false,
      }),
    ).toEqual({
      invoices: true,
      proposals: false,
      contracts: false,
      portal_invites: false,
      other: false,
    });
  });
});

describe('shouldUseCustomSendingDomain', () => {
  it('requires plan + toggle + verified domain', () => {
    expect(
      shouldUseCustomSendingDomain({
        allowedByPlan: true,
        featureEnabled: true,
        domainVerified: true,
      }),
    ).toBe(true);

    expect(
      shouldUseCustomSendingDomain({
        allowedByPlan: false,
        featureEnabled: true,
        domainVerified: true,
      }),
    ).toBe(false);

    expect(
      shouldUseCustomSendingDomain({
        allowedByPlan: true,
        featureEnabled: false,
        domainVerified: true,
      }),
    ).toBe(false);

    expect(
      shouldUseCustomSendingDomain({
        allowedByPlan: true,
        featureEnabled: true,
        domainVerified: false,
      }),
    ).toBe(false);
  });
});
