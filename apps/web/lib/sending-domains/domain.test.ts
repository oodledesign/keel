import { describe, expect, it } from 'vitest';

import {
  SendingDomainError,
  emailDomainOf,
  extractEmailAddress,
  formatSendingFromAddress,
  isSendingDomainVerified,
  normalizeSendingDomain,
  normalizeSendingLocalPart,
  normalizeSendingSubdomain,
  overallVerificationStatus,
  resolveMailFromHost,
  resolveSendingHost,
} from './domain';

describe('normalizeSendingDomain', () => {
  it('lowercases, strips protocol, www, path, and trailing dots', () => {
    expect(normalizeSendingDomain('https://www.Example.co.uk/listings')).toBe(
      'example.co.uk',
    );
    expect(normalizeSendingDomain('WWW.EXAMPLE.CO.UK.')).toBe('example.co.uk');
  });

  it('rejects emails as a domain', () => {
    expect(() => normalizeSendingDomain('listings@example.co.uk')).toThrow(
      SendingDomainError,
    );
    expect(() => normalizeSendingDomain('listings@example.co.uk')).toThrow(
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

describe('sending host', () => {
  it('defaults the sending host to mail.{apex}', () => {
    expect(resolveSendingHost('example.co.uk', 'mail')).toBe(
      'mail.example.co.uk',
    );
    expect(
      formatSendingFromAddress({
        localPart: 'mail',
        domain: 'example.co.uk',
        sendingSubdomain: 'mail',
      }),
    ).toBe('mail@mail.example.co.uk');
    expect(resolveMailFromHost('mail.example.co.uk')).toBe(
      'bounce.mail.example.co.uk',
    );
  });

  it('treats null or empty subdomain as apex opt-out', () => {
    expect(normalizeSendingSubdomain(null)).toBeNull();
    expect(normalizeSendingSubdomain('')).toBeNull();
    expect(normalizeSendingSubdomain('  ')).toBeNull();
    expect(resolveSendingHost('example.co.uk', null)).toBe('example.co.uk');
    expect(
      formatSendingFromAddress({
        localPart: 'mail',
        domain: 'example.co.uk',
        sendingSubdomain: null,
      }),
    ).toBe('mail@example.co.uk');
    expect(resolveMailFromHost('example.co.uk')).toBe('bounce.example.co.uk');
  });

  it('accepts other single-label subdomains', () => {
    expect(normalizeSendingSubdomain('Listings')).toBe('listings');
    expect(normalizeSendingSubdomain('go')).toBe('go');
    expect(normalizeSendingSubdomain('Agency')).toBe('agency');
    expect(resolveSendingHost('example.co.uk', 'hello')).toBe(
      'hello.example.co.uk',
    );
    expect(resolveSendingHost('example.co.uk', 'agency')).toBe(
      'agency.example.co.uk',
    );
    expect(
      formatSendingFromAddress({
        localPart: 'info',
        domain: 'example.co.uk',
        sendingSubdomain: 'agency',
      }),
    ).toBe('info@agency.example.co.uk');
  });

  it('rejects multi-label or invalid subdomains', () => {
    expect(() => normalizeSendingSubdomain('mail.listings')).toThrow(
      SendingDomainError,
    );
    expect(() => normalizeSendingSubdomain('hello world')).toThrow(
      SendingDomainError,
    );
  });
});

describe('normalizeSendingLocalPart', () => {
  it('accepts listings, hello, mail, and hyphenated custom names', () => {
    expect(normalizeSendingLocalPart('Listings')).toBe('listings');
    expect(normalizeSendingLocalPart('hello')).toBe('hello');
    expect(normalizeSendingLocalPart('mail')).toBe('mail');
    expect(normalizeSendingLocalPart('no-reply')).toBe('no-reply');
    expect(normalizeSendingLocalPart('No-Reply')).toBe('no-reply');
    expect(normalizeSendingLocalPart('accounts')).toBe('accounts');
    expect(normalizeSendingLocalPart('info')).toBe('info');
  });

  it('rejects spaces, leading hyphens, and trailing hyphens', () => {
    expect(() => normalizeSendingLocalPart('hello world')).toThrow(
      SendingDomainError,
    );
    expect(() => normalizeSendingLocalPart('-reply')).toThrow(
      SendingDomainError,
    );
    expect(() => normalizeSendingLocalPart('no-')).toThrow(SendingDomainError);
  });
});

describe('email helpers', () => {
  it('extracts the domain and address from a From header', () => {
    expect(emailDomainOf('listings@example.co.uk')).toBe('example.co.uk');
    expect(extractEmailAddress('Example <listings@example.co.uk>')).toBe(
      'listings@example.co.uk',
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
