import { describe, expect, it } from 'vitest';

import {
  SendingDomainError,
  emailDomainOf,
  extractEmailAddress,
  isSendingDomainVerified,
  normalizeSendingDomain,
  normalizeSendingLocalPart,
  overallVerificationStatus,
} from './domain';

describe('normalizeSendingDomain', () => {
  it('lowercases, strips protocol, www, path, and trailing dots', () => {
    expect(normalizeSendingDomain('https://www.Bracketts.co.uk/listings')).toBe(
      'bracketts.co.uk',
    );
    expect(normalizeSendingDomain('WWW.BRACKETTS.CO.UK.')).toBe(
      'bracketts.co.uk',
    );
  });

  it('rejects emails as a domain', () => {
    expect(() => normalizeSendingDomain('listings@bracketts.co.uk')).toThrow(
      SendingDomainError,
    );
    expect(() => normalizeSendingDomain('listings@bracketts.co.uk')).toThrow(
      /domain only/,
    );
  });

  it('rejects empty and invalid values', () => {
    expect(() => normalizeSendingDomain('')).toThrow(/Enter a domain/);
    expect(() => normalizeSendingDomain('not a domain')).toThrow(
      /valid domain/,
    );
    expect(() => normalizeSendingDomain('localhost')).toThrow(/valid domain/);
  });
});

describe('normalizeSendingLocalPart', () => {
  it('accepts listings, hello, and mail', () => {
    expect(normalizeSendingLocalPart('Listings')).toBe('listings');
    expect(normalizeSendingLocalPart('hello')).toBe('hello');
    expect(normalizeSendingLocalPart('mail')).toBe('mail');
  });

  it('rejects spaces and symbols', () => {
    expect(() => normalizeSendingLocalPart('hello world')).toThrow(
      SendingDomainError,
    );
  });
});

describe('email helpers', () => {
  it('extracts the domain and address from a From header', () => {
    expect(emailDomainOf('listings@bracketts.co.uk')).toBe('bracketts.co.uk');
    expect(extractEmailAddress('Bracketts <listings@bracketts.co.uk>')).toBe(
      'listings@bracketts.co.uk',
    );
  });
});

describe('verification status', () => {
  it('is verified only when DKIM and MAIL FROM both succeed', () => {
    expect(
      isSendingDomainVerified({
        dkim_status: 'success',
        mail_from_status: 'success',
      }),
    ).toBe(true);
    expect(
      isSendingDomainVerified({
        dkim_status: 'success',
        mail_from_status: 'pending',
      }),
    ).toBe(false);
    expect(
      overallVerificationStatus({
        dkim_status: 'failed',
        mail_from_status: 'success',
      }),
    ).toBe('failed');
    expect(
      overallVerificationStatus({
        dkim_status: 'pending',
        mail_from_status: 'pending',
      }),
    ).toBe('pending');
  });
});
