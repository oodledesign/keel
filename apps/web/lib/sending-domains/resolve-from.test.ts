import { describe, expect, it } from 'vitest';

import { sesTenantNameForAccount } from '@kit/ses/identity';
import { buildSesRawEmail } from '@kit/ses/raw-email';

import { getPlatformSesFrom, resolveWorkspaceMailFrom } from './resolve-from';

const pendingDomain = {
  domain: 'bracketts.co.uk',
  default_local_part: 'listings',
  dkim_status: 'pending',
  mail_from_status: 'pending',
  ses_tenant_name: 'ozer-account-11111111-1111-1111-1111-111111111111',
  ses_configuration_set: 'ozer-custom-domains',
};

const verifiedDomain = {
  ...pendingDomain,
  dkim_status: 'success',
  mail_from_status: 'success',
};

describe('resolveWorkspaceMailFrom', () => {
  it('uses the verified custom domain as From and includes tenant fields', () => {
    const resolved = resolveWorkspaceMailFrom({
      accountName: 'Bracketts',
      brandContactEmail: 'office@bracketts.co.uk',
      proposedFromEmail: 'old@ozer.so',
      sendingDomain: verifiedDomain,
      platformFrom: 'Ozer <hello@ozer.so>',
    });

    expect(resolved.source).toBe('custom_domain');
    expect(resolved.fromEmail).toBe('listings@bracketts.co.uk');
    expect(resolved.fromHeader).toBe(
      'Bracketts <listings@bracketts.co.uk>',
    );
    expect(resolved.replyTo).toBe('office@bracketts.co.uk');
    expect(resolved.sesTenantName).toBe(verifiedDomain.ses_tenant_name);
    expect(resolved.sesConfigurationSet).toBe('ozer-custom-domains');
    expect(resolved.verifiedCustomDomain).toBe(true);
  });

  it('does not use an unverified custom From and falls back to the platform sender', () => {
    const resolved = resolveWorkspaceMailFrom({
      accountName: 'Bracketts',
      brandContactEmail: 'listings@bracketts.co.uk',
      sendingDomain: pendingDomain,
      platformFrom: 'Ozer <hello@ozer.so>',
    });

    expect(resolved.source).toBe('platform');
    expect(resolved.fromEmail).toBe('hello@ozer.so');
    expect(resolved.fromHeader).toBe('Bracketts <hello@ozer.so>');
    expect(resolved.replyTo).toBe('listings@bracketts.co.uk');
    expect(resolved.sesTenantName).toBeNull();
    expect(resolved.sesConfigurationSet).toBeNull();
    expect(resolved.verifiedCustomDomain).toBe(false);
  });

  it('keeps an existing From that is not the unverified custom domain', () => {
    const resolved = resolveWorkspaceMailFrom({
      accountName: 'Bracketts',
      brandContactEmail: 'hello@ozer.so',
      sendingDomain: pendingDomain,
      platformFrom: 'Ozer <noreply@ozer.so>',
    });

    expect(resolved.source).toBe('existing');
    expect(resolved.fromEmail).toBe('hello@ozer.so');
    expect(resolved.sesTenantName).toBeNull();
  });
});

describe('tenant headers on SES send', () => {
  it('builds a tenant name and puts tenant + configuration-set headers on the raw message', () => {
    const accountId = '11111111-1111-1111-1111-111111111111';
    const tenant = sesTenantNameForAccount(accountId);
    expect(tenant).toBe(`ozer-account-${accountId}`);

    const resolved = resolveWorkspaceMailFrom({
      accountName: 'Bracketts',
      sendingDomain: {
        ...verifiedDomain,
        ses_tenant_name: tenant,
      },
      platformFrom: 'hello@ozer.so',
    });

    const raw = buildSesRawEmail({
      to: 'sam@example.com',
      from: resolved.fromHeader ?? '',
      subject: 'Matching opportunity',
      html: '<p>Hello</p>',
      sesTenant: resolved.sesTenantName ?? undefined,
      sesConfigurationSet: resolved.sesConfigurationSet ?? undefined,
    });

    expect(raw).toContain(`X-SES-TENANT: ${tenant}`);
    expect(raw).toContain('X-SES-CONFIGURATION-SET: ozer-custom-domains');
    expect(raw).toContain('From: Bracketts <listings@bracketts.co.uk>');
  });

  it('omits tenant headers when falling back to the platform sender', () => {
    const resolved = resolveWorkspaceMailFrom({
      accountName: 'Bracketts',
      brandContactEmail: 'listings@bracketts.co.uk',
      sendingDomain: pendingDomain,
      platformFrom: 'hello@ozer.so',
    });

    const raw = buildSesRawEmail({
      to: 'sam@example.com',
      from: resolved.fromHeader ?? '',
      subject: 'Matching opportunity',
      html: '<p>Hello</p>',
      sesTenant: resolved.sesTenantName ?? undefined,
      sesConfigurationSet: resolved.sesConfigurationSet ?? undefined,
    });

    expect(raw).not.toContain('X-SES-TENANT:');
    expect(raw).not.toContain('X-SES-CONFIGURATION-SET:');
  });
});

describe('getPlatformSesFrom', () => {
  it('prefers SES_FROM_ADDRESS then EMAIL_SENDER', () => {
    expect(
      getPlatformSesFrom({
        SES_FROM_ADDRESS: 'hello@ozer.so',
        EMAIL_SENDER: 'Ozer <other@ozer.so>',
      }),
    ).toBe('hello@ozer.so');
    expect(getPlatformSesFrom({ EMAIL_SENDER: 'Ozer <hello@ozer.so>' })).toBe(
      'Ozer <hello@ozer.so>',
    );
  });
});
