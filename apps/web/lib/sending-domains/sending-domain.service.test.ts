import { describe, expect, it, vi } from 'vitest';

import type { SesIdentityAdmin } from '@kit/ses';
import {
  isSesAccessDeniedError,
  mapSesIdentityAdminError,
  sesAccessDeniedUserMessage,
} from '@kit/ses/identity';

import { SendingDomainError } from './domain';
import { createSendingDomainService } from './sending-domain.service';

const accountId = '11111111-1111-1111-1111-111111111111';
const userId = '22222222-2222-2222-2222-222222222222';

function accessDenied(message = 'User is not authorized to perform: ses:CreateTenant') {
  const error = new Error(message);
  error.name = 'AccessDeniedException';
  return error;
}

function createMockSes(): SesIdentityAdmin {
  return {
    getRegion: () => 'eu-west-2',
    getAccountId: async () => '123456789012',
    createDomainIdentity: vi.fn().mockResolvedValue({
      tokens: ['aaa', 'bbb', 'ccc'],
      identityArn:
        'arn:aws:ses:eu-west-2:123456789012:identity/mail.example.co.uk',
    }),
    getDomainIdentity: vi.fn().mockResolvedValue({
      dkimStatus: 'success',
      mailFromStatus: 'success',
      verifiedForSending: true,
      tokens: ['aaa', 'bbb', 'ccc'],
      identityArn:
        'arn:aws:ses:eu-west-2:123456789012:identity/mail.example.co.uk',
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
    name: 'Example',
    is_personal_account: false,
    space_type: 'commercial-property',
  };

  const defaultInserted = {
    id: 'dom-1',
    account_id: accountId,
    domain: 'example.co.uk',
    sending_subdomain: 'mail',
    sending_host: 'mail.example.co.uk',
    mail_from_subdomain: 'bounce',
    default_local_part: 'mail',
    ses_identity_name: 'mail.example.co.uk',
    ses_identity_arn:
      'arn:aws:ses:eu-west-2:123456789012:identity/mail.example.co.uk',
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

  let lastInsertPayload: Record<string, unknown> | null = null;

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
      insert: vi.fn((payload: Record<string, unknown>) => {
        lastInsertPayload = payload;
        return chain;
      }),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        if (options?.insertError) {
          return Promise.resolve({ data: null, error: options.insertError });
        }

        const base = options?.inserted ?? defaultInserted;
        const merged = lastInsertPayload
          ? {
              ...base,
              ...lastInsertPayload,
              sending_host:
                (lastInsertPayload.ses_identity_name as string | undefined) ??
                (base.sending_host as string),
            }
          : base;

        return Promise.resolve({ data: merged, error: null });
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

  return { from, getLastInsertPayload: () => lastInsertPayload };
}

describe('SES AccessDenied helpers', () => {
  it('detects AccessDeniedException and 403 metadata', () => {
    expect(isSesAccessDeniedError(accessDenied())).toBe(true);

    const forbidden = new Error('Forbidden');
    (forbidden as { $metadata?: { httpStatusCode: number } }).$metadata = {
      httpStatusCode: 403,
    };
    expect(isSesAccessDeniedError(forbidden)).toBe(true);

    expect(isSesAccessDeniedError(new Error('SES throttled'))).toBe(false);
  });

  it('maps AccessDenied to an IAM guidance message', () => {
    const mapped = mapSesIdentityAdminError(accessDenied());
    expect(mapped.name).toBe('SesAccessDeniedError');
    expect(mapped.message).toBe(sesAccessDeniedUserMessage());
    expect(mapped.message).toMatch(/ses:CreateEmailIdentity/);
    expect(mapped.message).toMatch(/sts:GetCallerIdentity/);
  });
});

describe('SendingDomainService', () => {
  it('creates a domain identity, tenant, and pending row', async () => {
    const client = createMockClient();
    const ses = createMockSes();
    const service = createSendingDomainService(client as never, ses);

    const result = await service.createDomain({
      accountId,
      domain: 'https://www.Example.co.uk',
      userId,
    });

    expect(result.domain).toBe('example.co.uk');
    expect(result.sending_subdomain).toBe('mail');
    expect(result.sending_host).toBe('mail.example.co.uk');
    expect(result.default_local_part).toBe('mail');
    expect(result.ses_tenant_name).toBe(`ozer-account-${accountId}`);
    expect(ses.createDomainIdentity).toHaveBeenCalledWith('mail.example.co.uk');
    expect(ses.putMailFrom).toHaveBeenCalledWith(
      'mail.example.co.uk',
      'bounce.mail.example.co.uk',
    );
    expect(ses.ensureTenant).toHaveBeenCalledWith(`ozer-account-${accountId}`);
    expect(ses.associateTenantResource).toHaveBeenCalledTimes(2);
  });

  it('opts out to the apex identity when sending subdomain is empty', async () => {
    const client = createMockClient({
      inserted: {
        id: 'dom-1',
        account_id: accountId,
        domain: 'example.co.uk',
        sending_subdomain: null,
        sending_host: 'example.co.uk',
        mail_from_subdomain: 'bounce',
        default_local_part: 'mail',
        ses_identity_name: 'example.co.uk',
        ses_identity_arn:
          'arn:aws:ses:eu-west-2:123456789012:identity/example.co.uk',
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
      },
    });
    const ses = createMockSes();
    const service = createSendingDomainService(client as never, ses);

    const result = await service.createDomain({
      accountId,
      domain: 'example.co.uk',
      userId,
      sendingSubdomain: null,
    });

    expect(result.sending_subdomain).toBeNull();
    expect(result.sending_host).toBe('example.co.uk');
    expect(ses.createDomainIdentity).toHaveBeenCalledWith('example.co.uk');
    expect(ses.putMailFrom).toHaveBeenCalledWith(
      'example.co.uk',
      'bounce.example.co.uk',
    );
  });

  it('creates a custom sending subdomain and From local-part', async () => {
    const client = createMockClient({
      inserted: {
        id: 'dom-1',
        account_id: accountId,
        domain: 'example.co.uk',
        sending_subdomain: 'agency',
        sending_host: 'agency.example.co.uk',
        mail_from_subdomain: 'bounce',
        default_local_part: 'no-reply',
        ses_identity_name: 'agency.example.co.uk',
        ses_identity_arn:
          'arn:aws:ses:eu-west-2:123456789012:identity/agency.example.co.uk',
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
      },
    });
    const ses = createMockSes();
    const service = createSendingDomainService(client as never, ses);

    const result = await service.createDomain({
      accountId,
      domain: 'example.co.uk',
      userId,
      sendingSubdomain: 'agency',
      localPart: 'No-Reply',
    });

    expect(result.sending_subdomain).toBe('agency');
    expect(result.sending_host).toBe('agency.example.co.uk');
    expect(result.default_local_part).toBe('no-reply');
    expect(ses.createDomainIdentity).toHaveBeenCalledWith(
      'agency.example.co.uk',
    );
    expect(ses.putMailFrom).toHaveBeenCalledWith(
      'agency.example.co.uk',
      'bounce.agency.example.co.uk',
    );
  });

  it('maps CreateEmailIdentity AccessDenied to a clear IAM error', async () => {
    const client = createMockClient();
    const ses = createMockSes();
    ses.createDomainIdentity = vi.fn().mockRejectedValue(accessDenied(
      'User is not authorized to perform: ses:CreateEmailIdentity',
    ));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(
      createSendingDomainService(client as never, ses).createDomain({
        accountId,
        domain: 'example.co.uk',
        userId,
      }),
    ).rejects.toMatchObject({
      name: 'SendingDomainError',
      message: sesAccessDeniedUserMessage(),
    });

    expect(ses.deleteIdentity).not.toHaveBeenCalled();
    expect(ses.putMailFrom).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('cleans up the SES identity when putMailFrom AccessDenied', async () => {
    const client = createMockClient();
    const ses = createMockSes();
    ses.putMailFrom = vi.fn().mockRejectedValue(
      accessDenied(
        'User is not authorized to perform: ses:PutEmailIdentityMailFromAttributes',
      ),
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(
      createSendingDomainService(client as never, ses).createDomain({
        accountId,
        domain: 'example.co.uk',
        userId,
      }),
    ).rejects.toMatchObject({
      name: 'SendingDomainError',
      message: sesAccessDeniedUserMessage(),
    });

    expect(ses.deleteIdentity).toHaveBeenCalledWith('mail.example.co.uk');
    warn.mockRestore();
  });

  it('soft-fails tenant AccessDenied and stores a null tenant name', async () => {
    const client = createMockClient();
    const ses = createMockSes();
    ses.ensureTenant = vi.fn().mockRejectedValue(
      accessDenied('User is not authorized to perform: ses:CreateTenant'),
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = await createSendingDomainService(
      client as never,
      ses,
    ).createDomain({
      accountId,
      domain: 'example.co.uk',
      userId,
    });

    expect(result.ses_tenant_name).toBeNull();
    expect(client.getLastInsertPayload()?.ses_tenant_name).toBeNull();
    expect(ses.createDomainIdentity).toHaveBeenCalled();
    expect(ses.putMailFrom).toHaveBeenCalled();
    expect(ses.ensureConfigurationSet).toHaveBeenCalled();
    expect(ses.associateTenantResource).not.toHaveBeenCalled();
    expect(ses.deleteIdentity).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/tenant setup AccessDenied/i),
      expect.objectContaining({ accountId, sendingHost: 'mail.example.co.uk' }),
    );
    warn.mockRestore();
  });

  it('soft-fails tenant association AccessDenied after ensureTenant', async () => {
    const client = createMockClient();
    const ses = createMockSes();
    ses.associateTenantResource = vi.fn().mockRejectedValue(
      accessDenied(
        'User is not authorized to perform: ses:CreateTenantResourceAssociation',
      ),
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = await createSendingDomainService(
      client as never,
      ses,
    ).createDomain({
      accountId,
      domain: 'example.co.uk',
      userId,
    });

    expect(result.ses_tenant_name).toBeNull();
    expect(ses.ensureTenant).toHaveBeenCalled();
    expect(ses.deleteIdentity).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('does not soft-fail non-AccessDenied tenant errors and cleans up identity', async () => {
    const client = createMockClient();
    const ses = createMockSes();
    ses.ensureTenant = vi.fn().mockRejectedValue(new Error('SES throttled'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(
      createSendingDomainService(client as never, ses).createDomain({
        accountId,
        domain: 'example.co.uk',
        userId,
      }),
    ).rejects.toMatchObject({
      name: 'SendingDomainError',
      message: 'SES throttled',
    });

    expect(ses.deleteIdentity).toHaveBeenCalledWith('mail.example.co.uk');
    warn.mockRestore();
  });

  it('updates a custom From local-part including no-reply', async () => {
    const existing = {
      id: 'dom-1',
      account_id: accountId,
      domain: 'example.co.uk',
      sending_subdomain: 'mail',
      sending_host: 'mail.example.co.uk',
      mail_from_subdomain: 'bounce',
      default_local_part: 'mail',
      ses_identity_name: 'mail.example.co.uk',
      ses_identity_arn:
        'arn:aws:ses:eu-west-2:123456789012:identity/mail.example.co.uk',
      ses_tenant_name: `ozer-account-${accountId}`,
      ses_configuration_set: 'ozer-custom-domains',
      dkim_tokens: ['aaa', 'bbb', 'ccc'],
      dns_records: [],
      dkim_status: 'success',
      mail_from_status: 'success',
      verification_status: 'verified',
      verified_at: new Date().toISOString(),
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const client = createMockClient({
      existing,
      inserted: { ...existing, default_local_part: 'no-reply' },
    });
    const ses = createMockSes();
    const service = createSendingDomainService(client as never, ses);

    const result = await service.updateLocalPart(accountId, 'no-reply');

    expect(result.default_local_part).toBe('no-reply');
    expect(ses.createDomainIdentity).not.toHaveBeenCalled();
    expect(ses.deleteIdentity).not.toHaveBeenCalled();

    await expect(
      service.updateLocalPart(accountId, 'hello world'),
    ).rejects.toBeInstanceOf(SendingDomainError);
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
      createSendingDomainService(
        personal as never,
        createMockSes(),
      ).createDomain({
        accountId,
        domain: 'example.com',
        userId,
      }),
    ).rejects.toBeInstanceOf(SendingDomainError);

    await expect(
      createSendingDomainService(family as never, createMockSes()).createDomain(
        {
          accountId,
          domain: 'example.com',
          userId,
        },
      ),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/family/i),
    });
  });

  it('refuses a second domain on the same workspace', async () => {
    const client = createMockClient({
      existing: { id: 'existing', account_id: accountId },
    });

    await expect(
      createSendingDomainService(client as never, createMockSes()).createDomain(
        {
          accountId,
          domain: 'other.co.uk',
          userId,
        },
      ),
    ).rejects.toThrow(/already has a sending domain/);
  });

  it('removes the workspace row even if SES identity delete fails', async () => {
    const existing = {
      id: 'dom-1',
      account_id: accountId,
      domain: 'example.co.uk',
      sending_subdomain: 'mail',
      sending_host: 'mail.example.co.uk',
      mail_from_subdomain: 'bounce',
      default_local_part: 'mail',
      ses_identity_name: 'mail.example.co.uk',
      ses_identity_arn:
        'arn:aws:ses:eu-west-2:123456789012:identity/mail.example.co.uk',
      ses_tenant_name: `ozer-account-${accountId}`,
      ses_configuration_set: 'ozer-custom-domains',
      dkim_tokens: [],
      dns_records: [],
      dkim_status: 'pending',
      mail_from_status: 'pending',
      verification_status: 'pending',
      verified_at: null,
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const deleted = { eq: vi.fn().mockResolvedValue({ error: null }) };
    const from = vi.fn((table: string) => {
      if (table === 'accounts') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: accountId,
              name: 'Example',
              is_personal_account: false,
              space_type: 'commercial-property',
            },
            error: null,
          }),
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: existing, error: null }),
        delete: vi.fn(() => deleted),
      };
    });

    const ses = createMockSes();
    ses.deleteIdentity = vi.fn().mockRejectedValue(new Error('SES throttled'));

    const result = await createSendingDomainService(
      { from } as never,
      ses,
    ).removeDomain(accountId);

    expect(deleted.eq).toHaveBeenCalledWith('id', 'dom-1');
    expect(result.sesCleanupFailed).toMatch(/SES throttled/);
  });
});
