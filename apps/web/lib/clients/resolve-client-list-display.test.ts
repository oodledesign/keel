import { describe, expect, it } from 'vitest';

import {
  resolveClientListTagline,
  resolveClientListTitle,
  resolveStoredClientDisplayName,
} from './resolve-client-list-display';

describe('resolveStoredClientDisplayName', () => {
  it('prefers company name for business clients', () => {
    expect(
      resolveStoredClientDisplayName({
        clientType: 'business',
        companyName: 'Hope and Wonder',
        firstName: 'Jane',
        lastName: 'Doe',
      }),
    ).toBe('Hope and Wonder');
  });
});

describe('resolveClientListTitle', () => {
  it('shows company name for business clients', () => {
    expect(
      resolveClientListTitle({
        client_type: 'business',
        company_name: 'Hope and Wonder',
        first_name: 'Jane',
        last_name: 'Doe',
        display_name: 'Hope and Wonder',
      }),
    ).toBe('Hope and Wonder');
  });
});

describe('resolveClientListTagline', () => {
  it('shows person name when business contact differs from company', () => {
    expect(
      resolveClientListTagline({
        client_type: 'business',
        company_name: 'Hope and Wonder',
        first_name: 'Jane',
        last_name: 'Doe',
      }),
    ).toBe('Jane Doe');
  });
});
