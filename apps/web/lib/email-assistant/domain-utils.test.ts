import { describe, expect, it } from 'vitest';

import {
  domainsFromEmails,
  extractEmailDomain,
  isPublicEmailDomain,
  normalizeWebsiteDomain,
  pickUniqueClientMatch,
} from './domain-utils';

describe('extractEmailDomain', () => {
  it('parses plain and angle-bracket emails', () => {
    expect(extractEmailDomain('Ada <ada@acme.co.uk>')).toBe('acme.co.uk');
    expect(extractEmailDomain('bob@Example.COM')).toBe('example.com');
  });

  it('returns null for invalid values', () => {
    expect(extractEmailDomain(null)).toBeNull();
    expect(extractEmailDomain('not-an-email')).toBeNull();
  });
});

describe('normalizeWebsiteDomain', () => {
  it('strips protocol and www', () => {
    expect(normalizeWebsiteDomain('https://www.acme.co.uk/path')).toBe(
      'acme.co.uk',
    );
    expect(normalizeWebsiteDomain('acme.co.uk')).toBe('acme.co.uk');
  });
});

describe('isPublicEmailDomain', () => {
  it('flags consumer providers', () => {
    expect(isPublicEmailDomain('gmail.com')).toBe(true);
    expect(isPublicEmailDomain('outlook.com')).toBe(true);
    expect(isPublicEmailDomain('acme.co.uk')).toBe(false);
  });
});

describe('domainsFromEmails', () => {
  it('skips public domains', () => {
    expect(
      domainsFromEmails(['a@gmail.com', 'b@acme.co.uk', 'c@Acme.co.uk']),
    ).toEqual(['acme.co.uk']);
  });
});

describe('pickUniqueClientMatch', () => {
  const matches = [
    { id: '1', account_id: 'a' },
    { id: '2', account_id: 'b' },
  ];

  it('returns the only match', () => {
    expect(pickUniqueClientMatch([matches[0]!])).toEqual(matches[0]);
  });

  it('returns null when ambiguous without preference', () => {
    expect(pickUniqueClientMatch(matches)).toBeNull();
  });

  it('prefers a unique match in preferred account', () => {
    expect(pickUniqueClientMatch(matches, 'b')).toEqual(matches[1]);
  });

  it('returns null when preferred account still ambiguous', () => {
    expect(
      pickUniqueClientMatch(
        [
          { id: '1', account_id: 'a' },
          { id: '2', account_id: 'a' },
        ],
        'a',
      ),
    ).toBeNull();
  });
});
