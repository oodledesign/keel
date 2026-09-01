import { describe, expect, it } from 'vitest';

import {
  AddSendingDomainSchema,
  UpdateSendingLocalPartSchema,
} from '~/home/[account]/settings/_lib/schema/sending-domain.schema';

const accountId = '11111111-1111-1111-1111-111111111111';

describe('AddSendingDomainSchema', () => {
  it('accepts a custom subdomain and hyphenated local-part', () => {
    const parsed = AddSendingDomainSchema.parse({
      accountId,
      domain: 'example.co.uk',
      sendingSubdomain: 'agency',
      localPart: 'no-reply',
    });

    expect(parsed.sendingSubdomain).toBe('agency');
    expect(parsed.localPart).toBe('no-reply');
  });

  it('accepts typed local-parts such as accounts and info', () => {
    expect(
      AddSendingDomainSchema.parse({
        accountId,
        domain: 'example.co.uk',
        localPart: 'accounts',
      }).localPart,
    ).toBe('accounts');
    expect(
      AddSendingDomainSchema.parse({
        accountId,
        domain: 'example.co.uk',
        localPart: 'info',
      }).localPart,
    ).toBe('info');
  });

  it('rejects a dotted subdomain', () => {
    const result = AddSendingDomainSchema.safeParse({
      accountId,
      domain: 'example.co.uk',
      sendingSubdomain: 'mail.listings',
    });

    expect(result.success).toBe(false);
  });
});

describe('UpdateSendingLocalPartSchema', () => {
  it('accepts no-reply and other custom local-parts', () => {
    expect(
      UpdateSendingLocalPartSchema.parse({
        accountId,
        localPart: 'no-reply',
      }).localPart,
    ).toBe('no-reply');
    expect(
      UpdateSendingLocalPartSchema.parse({
        accountId,
        localPart: 'accounts',
      }).localPart,
    ).toBe('accounts');
  });

  it('rejects spaces in the local-part', () => {
    const result = UpdateSendingLocalPartSchema.safeParse({
      accountId,
      localPart: 'hello world',
    });

    expect(result.success).toBe(false);
  });
});
