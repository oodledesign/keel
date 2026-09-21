import { describe, expect, it } from 'vitest';

import {
  firstNameFromSignedInUser,
  inviteGreeting,
} from './invite-greeting-name';

describe('firstNameFromSignedInUser', () => {
  it('prefers first_name from auth metadata', () => {
    expect(
      firstNameFromSignedInUser({
        userMetadata: { first_name: 'abbey', name: 'Other Person' },
        email: 'other@example.com',
      }),
    ).toBe('Abbey');
  });

  it('uses the first token of a full name', () => {
    expect(
      firstNameFromSignedInUser({
        userMetadata: { full_name: 'Ada Lovelace' },
        email: 'ada@example.com',
      }),
    ).toBe('Ada');
  });

  it('falls back to a capitalized email local-part', () => {
    expect(
      firstNameFromSignedInUser({
        userMetadata: {},
        email: 'sam.taylor@example.com',
      }),
    ).toBe('Sam');
  });

  it('returns null when nothing usable is present', () => {
    expect(firstNameFromSignedInUser({ userMetadata: {}, email: null })).toBe(
      null,
    );
  });
});

describe('inviteGreeting', () => {
  it('includes the first name when available', () => {
    expect(inviteGreeting('Abbey')).toBe('Hi Abbey,');
  });

  it('falls back to Hi, without a name', () => {
    expect(inviteGreeting(null)).toBe('Hi,');
  });
});
