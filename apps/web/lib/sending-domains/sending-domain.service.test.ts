import { describe, expect, it, vi } from 'vitest';

import type { SesIdentityAdmin } from '@kit/ses';

import { SendingDomainError } from './domain';
import { createSendingDomainService } from './sending-domain.service';

const accountId = '11111111-1111-1111-1111-111111111111';
const userId = '22222222-2222-2222-2222-222222222222';

function createMockSes(): SesIdentityAdmin {
  return {
    getRegion: () => 'eu-west-2',
    getAccountId: async () => '123456789012',
    createDomainIdentity: vi.fn().mockResolvedValue({
      tokens: ['aaa', 'bbb', 'ccc'],
      identityArn:
        'arn:aws:ses:eu-west-2:123456789012:identity/bracketts.co.uk',
    }),
    getDomainIdentity: vi.fn().mockResolvedValue({
      dkimStatus: 'success',
      mailFromStatus: 'success',
      verifiedForSending: true,
      tokens: ['aaa', 'bbb', 'ccc'],
      identityArn:
        'arn:aws:ses:eu-west-2:123456789012:identity/bracketts.co.uk',
    }),
    putMailFrom: vi.fn().mockResolvedValue(undefined),
    deleteIdentity: vi.fn().mockResolvedValue(undefined),
    ensureConfigurationSet: vi.fn().mockResolvedValue({
      arn: 'arn:aws:ses:eu-west-2:123456789012:configuration-set/ozer-custom-domains',
    }),
    ensureTenant: vi.fn().mockResolvedValue(undefined),
    associateTenantResource: vi.fn().mockResolvedValue(undefined),
    disassociateTenantResource: vi.fn().mockResolvedValue(undefined),
    deleteTenant: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockClient(options?: {
  account?: Record<string, unknown> | null;
  existing?: Record<string, unknown> | null;
  claimed?: Record<string, unknown> | null;
  insertError?: { message: string; code?: string } | null;
  inserted?: Record<string, unknown> | null;
}) {
  const account = options?.account ?? {
    id: accountId,
    name: 'Bracketts',
    is_personal_account: false,
    space_type: 'commercial-property',
  };

  const inserted = options?.inserted ?? {
    id: 'dom-1',
    account_id: accountId,
    domain: 'bracketts.co.uk',
    mail_from_subdomain: 'bounce',
    default_local_part: 'listings',
    ses_identity_name: 'bracketts.co.uk',
    ses_identity_arn:
      'arn:aws:ses:eu-west-2:123456789012:identity/bracketts.co.uk',
    ses_tenant_name: `ozer-account-${accountId}`,
    ses_configuration_set: 'ozer-custom-domains',
    dkim_tokens: ['aaa', 'bbb', 'ccc'],
    dns_records: [],
    dkim_status: 'pending',
    mail_from_status: 'pending',
    verification_status: 'pending',
    verified_at: null,
    created_by: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const from = vi.fn((table: string) => {
    if (table === 'accounts') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: account, error: null }),
      };
    }

    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: options?.insertError ? null : inserted,
        error: options?.insertError ?? null,
      }),
      maybeSingle: vi.fn().mockImplementation(() => {
        if (chain.eq.mock.calls.some((call) => call[0] === 'domain')) {
          return Promise.resolve({
            data: options?.claimed ?? null,
            error: null,
          });
        }
        return Promise.resolve({
          data: options?.existing ?? null,
          error: null,
        });
      }),
    };
    return chain;
  });

  return { from };
}

describe('SendingDomainService', () => {
  it('creates a domain identity, tenant, and pending row', async () => {
    const client = createMockClient();
    const ses = createMockSes();
    const service = createSendingDomainService(
      client as never,
      ses,
    );

    const result = await service.createDomain({
      accountId,
      domain: 'https://www.Bracketts.co.uk',
      userId,
    });

    expect(result.domain).toBe('bracketts.co.uk');
    expect(result.ses_tenant_name).toBe(`ozer-account-${accountId}`);
    expect(ses.createDomainIdentity).toHaveBeenCalledWith('bracketts.co.uk');
    expect(ses.putMailFrom).toHaveBeenCalledWith(
      'bracketts.co.uk',
      'bounce.bracketts.co.uk',
    );
    expect(ses.ensureTenant).toHaveBeenCalledWith(
      `ozer-account-${accountId}`,
    );
    expect(ses.associateTenantResource).toHaveBeenCalledTimes(2);
  });

  it('rejects personal and family workspaces', async () => {
    const personal = createMockClient({
      account: {
        id: accountId,
        name: 'Dan',
        is_personal_account: true,
        space_type: 'work',
      },
    });
    const family = createMockClient({
      account: {
        id: accountId,
        name: 'Family',
        is_personal_account: false,
        space_type: 'family',
      },
    });

    await expect(
      createSendingDomainService(personal as never, createMockSes()).createDomain({
        accountId,
        domain: 'example.com',
        userId,
      }),
    ).rejects.toBeInstanceOf(SendingDomainError);

    await expect(
      createSendingDomainService(family as never, createMockSes()).createDomain({
        accountId,
        domain: 'example.com',
        userId,
      }),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/family/i),
    });
  });

  it('refuses a second domain on the same workspace', async () => {
    const client = createMockClient({
      existing: { id: 'existing', account_id: accountId },
    });

    await expect(
      createSendingDomainService(client as never, createMockSes()).createDomain({
        accountId,
        domain: 'other.co.uk',
        userId,
      }),
    ).rejects.toThrow(/already has a sending domain/);
  });
});
